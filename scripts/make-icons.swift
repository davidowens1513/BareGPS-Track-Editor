import AppKit
let sizes = [1024, 512, 192, 162, 144, 108, 96, 81, 72, 54, 48, 36]
for size in sizes {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let s = CGFloat(size) / 48
    let ctx = NSGraphicsContext.current!.cgContext
    ctx.scaleBy(x: s, y: s)
    ctx.setFillColor(NSColor(srgbRed: 20/255, green: 102/255, blue: 68/255, alpha: 1).cgColor)
    ctx.fill(CGRect(x: 0, y: 0, width: 48, height: 48))
    ctx.setStrokeColor(NSColor.white.cgColor); ctx.setLineWidth(2.6); ctx.setLineJoin(.round); ctx.setLineCap(.round)
    // Same vector mark as the in-app logo; y is inverted from the SVG coordinate space.
    ctx.move(to: CGPoint(x: 9, y: 16)); ctx.addLine(to: CGPoint(x: 21, y: 35)); ctx.addLine(to: CGPoint(x: 28, y: 24)); ctx.addLine(to: CGPoint(x: 32, y: 30)); ctx.addLine(to: CGPoint(x: 40, y: 16)); ctx.closePath(); ctx.strokePath()
    ctx.setLineWidth(1.8); ctx.move(to: CGPoint(x: 17, y: 28)); ctx.addLine(to: CGPoint(x: 21, y: 24)); ctx.addLine(to: CGPoint(x: 25, y: 28)); ctx.strokePath()
    ctx.setFillColor(NSColor(srgbRed: 205/255, green: 229/255, blue: 144/255, alpha: 1).cgColor); ctx.fillEllipse(in: CGRect(x: 31, y: 33, width: 6, height: 6))
    NSGraphicsContext.restoreGraphicsState()
    try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "/tmp/baregps-icon-\(size).png"))
}
let splashSize = 2732
let splash = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: splashSize, pixelsHigh: splashSize, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: splash)
NSColor(srgbRed: 245/255, green: 246/255, blue: 242/255, alpha: 1).setFill()
NSBezierPath(rect: NSRect(x: 0,y: 0,width: splashSize,height: splashSize)).fill()
NSImage(contentsOfFile: "/tmp/baregps-icon-1024.png")!.draw(in: NSRect(x: 1226,y: 1226,width: 280,height: 280))
NSGraphicsContext.restoreGraphicsState()
try splash.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "/tmp/baregps-splash.png"))
