import AppKit

// UIColor.systemGreen in light appearance, matching BareGPS Ireland's title.
let brandGreen = NSColor(srgbRed: 255/255, green: 59/255, blue: 48/255, alpha: 1)
let sizes = [1024, 512, 192, 162, 144, 108, 96, 81, 72, 54, 48, 36]
func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x, y: 48-y) }
for size in sizes {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let s = CGFloat(size) / 48
    let ctx = NSGraphicsContext.current!.cgContext
    ctx.scaleBy(x: s, y: s)
    ctx.setFillColor(brandGreen.cgColor)
    ctx.fill(CGRect(x: 0, y: 0, width: 48, height: 48))
    ctx.setStrokeColor(NSColor.white.cgColor)
    ctx.setLineWidth(2.8); ctx.setLineJoin(.round); ctx.setLineCap(.round)
    // Same winding connection and two endpoint rings as public/logo.svg.
    ctx.move(to: point(12,35))
    ctx.addCurve(to: point(22,25), control1: point(8,28), control2: point(13,23))
    ctx.addCurve(to: point(29,17), control1: point(31,27), control2: point(39,23))
    ctx.addCurve(to: point(36,12), control1: point(19,11), control2: point(23,10))
    ctx.strokePath()
    for p in [point(12,35),point(36,12)] {
        let circle=CGRect(x:p.x-4.2,y:p.y-4.2,width:8.4,height:8.4)
        ctx.fillEllipse(in:circle); ctx.strokeEllipse(in:circle)
    }
    NSGraphicsContext.restoreGraphicsState()
    let data=rep.representation(using:.png,properties:[:])!
    try data.write(to:URL(fileURLWithPath:"/tmp/baregps-icon-\(size).png"))
    if size==1024 {
        try data.write(to:URL(fileURLWithPath:"ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"))
    }
    let densities=[48:"mdpi",72:"hdpi",96:"xhdpi",144:"xxhdpi",192:"xxxhdpi"]
    if let density=densities[size] {
        for name in ["ic_launcher.png","ic_launcher_round.png"] {
            try data.write(to:URL(fileURLWithPath:"android/app/src/main/res/mipmap-\(density)/\(name)"))
        }
    }
}
let splashSize=2732
let splash=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:splashSize,pixelsHigh:splashSize,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:splash)
NSColor(srgbRed:245/255,green:246/255,blue:242/255,alpha:1).setFill()
NSBezierPath(rect:NSRect(x:0,y:0,width:splashSize,height:splashSize)).fill()
NSImage(contentsOfFile:"/tmp/baregps-icon-1024.png")!.draw(in:NSRect(x:1226,y:1226,width:280,height:280))
NSGraphicsContext.restoreGraphicsState()
let data=splash.representation(using:.png,properties:[:])!
try data.write(to:URL(fileURLWithPath:"/tmp/baregps-splash.png"))
for name in ["splash-2732x2732.png","splash-2732x2732-1.png","splash-2732x2732-2.png"] {
    try data.write(to:URL(fileURLWithPath:"ios/App/App/Assets.xcassets/Splash.imageset/\(name)"))
}
