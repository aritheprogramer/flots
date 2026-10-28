import AppKit
import Foundation
// Same two Bézier waves as the original Flots icon, exported as an alpha mask.
let pixels = 256
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)!
NSGraphicsContext.current!.cgContext.scaleBy(x: 0.25, y: 0.25)
NSColor.white.setStroke()
for y in [400.0, 590.0] {
  let wave = NSBezierPath()
  wave.move(to: NSPoint(x: 238, y: y))
  wave.curve(to: NSPoint(x: 512, y: y), controlPoint1: NSPoint(x: 344, y: y + 178), controlPoint2: NSPoint(x: 408, y: y - 178))
  wave.curve(to: NSPoint(x: 786, y: y), controlPoint1: NSPoint(x: 618, y: y + 178), controlPoint2: NSPoint(x: 682, y: y - 178))
  wave.lineWidth = 57; wave.lineCapStyle = .round; wave.stroke()
}
NSGraphicsContext.restoreGraphicsState()
try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "assets/flots-wave-mask.png"))
