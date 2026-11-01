import AppKit
import Foundation

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: swift make-dev-app-icon.swift <production.png> <development.png>\n", stderr)
    exit(64)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let image = NSImage(contentsOf: inputURL) else {
    fputs("Could not read production icon: \(inputURL.path)\n", stderr)
    exit(65)
}

let pixels = 1024
guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: pixels,
    pixelsHigh: pixels,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
), let bytes = bitmap.bitmapData else {
    fputs("Could not allocate development icon bitmap.\n", stderr)
    exit(70)
}

NSGraphicsContext.saveGraphicsState()
guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else { exit(70) }
NSGraphicsContext.current = context
context.imageInterpolation = .high
context.cgContext.clear(CGRect(x: 0, y: 0, width: pixels, height: pixels))
image.draw(in: NSRect(x: 0, y: 0, width: pixels, height: pixels))
context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

let bytesPerRow = bitmap.bytesPerRow
for y in 0..<pixels {
    for x in 0..<pixels {
        let offset = y * bytesPerRow + x * 4
        let red = Int(bytes[offset])
        let green = Int(bytes[offset + 1])
        let blue = Int(bytes[offset + 2])
        let alpha = bytes[offset + 3]
        // Recolor only the red H; preserve the tile, brackets, antialiasing, and transparency.
        if alpha > 0 && red > green + 45 && red > blue + 45 {
            bytes[offset] = 37
            bytes[offset + 1] = 37
            bytes[offset + 2] = 37
        }
    }
}

guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fputs("Could not encode development icon.\n", stderr)
    exit(74)
}
try png.write(to: outputURL, options: .atomic)
