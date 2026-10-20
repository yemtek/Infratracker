import os
import zlib
import struct

os.makedirs('public', exist_ok=True)

def create_png(width, height, draw_fn, filename):
    # PNG signature
    png = bytearray(b'\x89PNG\r\n\x1a\n')

    # IHDR chunk
    # width (4), height (4), bit depth (1: 8), color type (1: 6 RGBA), compression (1: 0), filter (1: 0), interlace (1: 0)
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png += struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', zlib.crc32(b'IHDR' + ihdr_data))

    # Raw image data: height lines, each starts with filter byte 0, followed by width * 4 bytes (RGBA)
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # filter type None
        for x in range(width):
            r, g, b, a = draw_fn(x, y, width, height)
            raw_data.extend((r, g, b, a))

    # IDAT chunk
    compressed = zlib.compress(bytes(raw_data), 9)
    png += struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', zlib.crc32(b'IDAT' + compressed))

    # IEND chunk
    png += struct.pack('>I', 0) + b'IEND' + struct.pack('>I', zlib.crc32(b'IEND'))

    with open(filename, 'wb') as f:
        f.write(png)
    print(f"Created {filename} ({width}x{height})")

def draw_icon(x, y, w, h, is_maskable=False):
    # Background: dark slate #0b1120
    # Safe zone for maskable icons is inset by 15%
    padding = int(w * 0.15) if is_maskable else int(w * 0.08)
    
    # Inner box coordinates
    bx0, by0 = padding, padding
    bx1, by1 = w - padding, h - padding
    
    # Check if point is inside rounded rack enclosure
    corner_r = int(w * 0.12)
    in_rack = False
    
    if bx0 <= x <= bx1 and by0 <= y <= by1:
        # Check corners
        dx = 0
        if x < bx0 + corner_r:
            dx = (bx0 + corner_r) - x
        elif x > bx1 - corner_r:
            dx = x - (bx1 - corner_r)
            
        dy = 0
        if y < by0 + corner_r:
            dy = (by0 + corner_r) - y
        elif y > by1 - corner_r:
            dy = y - (by1 - corner_r)
            
        if dx * dx + dy * dy <= corner_r * corner_r:
            in_rack = True
    
    if not in_rack:
        # Outside enclosure
        if is_maskable:
            return (11, 17, 32, 255) # Fill background for maskable
        return (0, 0, 0, 0)
    
    # Inside rack frame
    # Dark cabinet body #0f172a
    # Draw horizontal server units with emerald LED indicators
    u_margin_x = int(w * 0.08)
    u_left = bx0 + u_margin_x
    u_right = bx1 - u_margin_x
    
    # 3 server blades inside
    u_spacing = int((by1 - by0) * 0.22)
    u_height = int((by1 - by0) * 0.14)
    start_y = by0 + int((by1 - by0) * 0.18)
    
    for i in range(3):
        uy0 = start_y + i * u_spacing
        uy1 = uy0 + u_height
        if u_left <= x <= u_right and uy0 <= y <= uy1:
            # Server unit
            # LED at left:
            led_center_x = u_left + int(u_height * 0.5)
            led_center_y = (uy0 + uy1) // 2
            led_r = max(2, int(u_height * 0.22))
            
            if (x - led_center_x)**2 + (y - led_center_y)**2 <= led_r**2:
                # Emerald LED glow #10b981
                return (16, 185, 129, 255)
            
            # Port indicators at right:
            port_x0 = u_right - int(u_height * 1.4)
            if port_x0 <= x <= u_right - int(u_height * 0.3):
                if (uy0 + 3) <= y <= (uy1 - 3):
                    return (6, 182, 212, 255) # Cyan port #06b6d4
                    
            # Server faceplate #1e293b
            return (30, 41, 59, 255)
            
    # Default enclosure interior
    # Gradient/subtle dark slate
    return (15, 23, 42, 255)

create_png(192, 192, lambda x, y, w, h: draw_icon(x, y, w, h, False), 'public/pwa-192x192.png')
create_png(512, 512, lambda x, y, w, h: draw_icon(x, y, w, h, False), 'public/pwa-512x512.png')
create_png(512, 512, lambda x, y, w, h: draw_icon(x, y, w, h, True), 'public/pwa-maskable-512x512.png')
create_png(180, 180, lambda x, y, w, h: draw_icon(x, y, w, h, False), 'public/apple-touch-icon.png')
create_png(64, 64, lambda x, y, w, h: draw_icon(x, y, w, h, False), 'public/favicon.ico')
print("All PWA icons successfully generated.")
