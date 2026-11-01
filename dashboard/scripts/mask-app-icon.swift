import AppKit
import Foundation

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: swift mask-app-icon.swift <input.png> <output.png>\n", stderr)
    exit(64)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let source = NSImage(contentsOf: inputURL) else {
    fputs("Could not read source icon: \(inputURL.path)\n", stderr)
    exit(65)
}

let pixels = 1024
let canvas = NSSize(width: pixels, height: pixels)
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
) else {
    fputs("Could not allocate icon bitmap.\n", stderr)
    exit(70)
}

NSGraphicsContext.saveGraphicsState()
guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fputs("Could not create icon graphics context.\n", stderr)
    exit(70)
}
NSGraphicsContext.current = context
context.imageInterpolation = .high
context.cgContext.clear(CGRect(x: 0, y: 0, width: pixels, height: pixels))

// The generated artwork contains a 948 px rounded tile inset by 38 px.
// macOS does not apply an iOS-style mask, so clip the artwork explicitly.
let tile = NSRect(x: 38, y: 38, width: 948, height: 948)
NSBezierPath(roundedRect: tile, xRadius: 154, yRadius: 154).addClip()
source.draw(
    in: NSRect(origin: .zero, size: canvas),
    from: NSRect(origin: .zero, size: source.size),
    operation: .sourceOver,
    fraction: 1
)
context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fputs("Could not encode masked icon.\n", stderr)
    exit(74)
}
try png.write(to: outputURL, options: .atomic)
