#import <AppKit/AppKit.h>
#import <objc/runtime.h>
#include <node_api.h>
#include <cstring>
#include <cmath>

// Public AppKit API only. These background views never intercept browser input.
@interface FlotsGlassHost : NSView
@end
@implementation FlotsGlassHost
- (BOOL)isFlipped { return YES; }
- (NSView *)hitTest:(NSPoint)point { return nil; }
@end
static char hostKey;
static napi_value Update(napi_env env, napi_callback_info info) {
  size_t argc = 4; napi_value args[4]; napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  bool buffer = false, enabled = false; double top = 0, left = 0; void *bytes = nullptr; size_t length = 0;
  if (argc != 4 || napi_is_buffer(env, args[0], &buffer) != napi_ok || !buffer ||
      napi_get_buffer_info(env, args[0], &bytes, &length) != napi_ok || length != sizeof(void *) ||
      napi_get_value_double(env, args[1], &top) != napi_ok || napi_get_value_double(env, args[2], &left) != napi_ok ||
      napi_get_value_bool(env, args[3], &enabled) != napi_ok || !std::isfinite(top) || !std::isfinite(left)) {
    napi_throw_type_error(env, nullptr, "Invalid native glass parameters"); return nullptr;
  }
  if (![NSThread isMainThread]) { napi_throw_error(env, nullptr, "Glass requires the main thread"); return nullptr; }
  bool active = false;
  if (@available(macOS 26.0, *)) {
    void *pointer = nullptr; std::memcpy(&pointer, bytes, sizeof(pointer));
    NSView *root = (__bridge NSView *)pointer;
    if (root && root.window && root.superview) {
      FlotsGlassHost *host = objc_getAssociatedObject(root, &hostKey);
      if (!enabled || NSWorkspace.sharedWorkspace.accessibilityDisplayShouldReduceTransparency || NSWorkspace.sharedWorkspace.accessibilityDisplayShouldIncreaseContrast) {
        [host removeFromSuperview]; objc_setAssociatedObject(root, &hostKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
      } else {
        if (!host) {
          host = [[FlotsGlassHost alloc] initWithFrame:root.frame];
          host.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
          for (int i = 0; i < 2; i++) {
            NSGlassEffectView *glass = [[NSGlassEffectView alloc] initWithFrame:NSZeroRect];
            glass.style = NSGlassEffectViewStyleRegular; glass.cornerRadius = 0;
            [host addSubview:glass];
          }
          objc_setAssociatedObject(root, &hostKey, host, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
        }
        // Chromium owns the content view's layer composition. A material inside
        // that tree can be promoted above its surfaces when a page is attached.
        // Keep the glass a sibling behind the entire content root instead.
        [root.superview addSubview:host positioned:NSWindowBelow relativeTo:root];
        const CGFloat width = root.bounds.size.width, height = root.bounds.size.height;
        top = fmax(0, fmin(top, height)); left = fmax(0, fmin(left, width));
        host.frame = root.frame;
        host.subviews[0].frame = NSMakeRect(0, 0, width, top);
        host.subviews[1].frame = NSMakeRect(0, top, left, fmax(0, height - top));
        host.subviews[1].hidden = left == 0;
        root.window.opaque = NO; root.window.backgroundColor = NSColor.clearColor;
        NSArray<NSView *> *siblings = root.superview.subviews;
        active = host.superview == root.superview &&
                 [siblings indexOfObjectIdenticalTo:host] < [siblings indexOfObjectIdenticalTo:root];
        if (!active) {
          [host removeFromSuperview];
          objc_setAssociatedObject(root, &hostKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
        }
      }
    }
  }
  napi_value result; napi_get_boolean(env, active, &result); return result;
}
static napi_value Init(napi_env env, napi_value exports) {
  napi_value fn; napi_create_function(env, "update", NAPI_AUTO_LENGTH, Update, nullptr, &fn);
  napi_set_named_property(env, exports, "update", fn); return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
