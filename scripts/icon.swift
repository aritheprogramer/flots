import AppKit
import Foundation
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("assets/flots.iconset")
try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let pixels = size * scale
        let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        let context = NSGraphicsContext(bitmapImageRep: rep)!
        NSGraphicsContext.current = context
        context.cgContext.scaleBy(x: CGFloat(pixels) / 1024, y: CGFloat(pixels) / 1024)
        let tile = NSBezierPath(roundedRect: NSRect(x: 62, y: 62, width: 900, height: 900), xRadius: 205, yRadius: 205)
        NSGradient(starting: NSColor(calibratedRed: 0.81, green: 0.86, blue: 0.76, alpha: 1), ending: NSColor(calibratedRed: 0.43, green: 0.58, blue: 0.44, alpha: 1))!.draw(in: tile, angle: -70)
        NSColor(calibratedRed: 0.97, green: 0.98, blue: 0.93, alpha: 1).setStroke()
        for y in [400.0, 590.0] {
            let wave = NSBezierPath()
            wave.move(to: NSPoint(x: 238, y: y))
            wave.curve(to: NSPoint(x: 512, y: y), controlPoint1: NSPoint(x: 344, y: y + 178), controlPoint2: NSPoint(x: 408, y: y - 178))
            wave.curve(to: NSPoint(x: 786, y: y), controlPoint1: NSPoint(x: 618, y: y + 178), controlPoint2: NSPoint(x: 682, y: y - 178))
            wave.lineWidth = 57; wave.lineCapStyle = .round; wave.stroke()
        }
        NSGraphicsContext.restoreGraphicsState()
        let suffix = scale == 2 ? "@2x" : ""
        try rep.representation(using: .png, properties: [:])!.write(to: root.appendingPathComponent("icon_\(size)x\(size)\(suffix).png"))
    }
}
