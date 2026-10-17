import io
import qrcode
from qrcode.constants import ERROR_CORRECT_M
from django.conf import settings


def generate_qr_image(machine_code: str, base_url: str = None) -> bytes:
    """
    Generates a high-quality PNG QR Code in memory for a given machine code.
    
    The QR code encodes the URL that points to the customer frontend page,
    e.g. http://localhost:5173/?machine=W-1
    """
    # 1. Determine the frontend base URL (from settings or fallback)
    if not base_url:
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')

    # Remove trailing slash if present
    base_url = base_url.rstrip('/')

    # 2. Build the unique customer target URL
    # Supports both clean query param and path route:
    target_url = f"{base_url}/?machine={machine_code}"

    # 3. Configure the QR code matrix
    qr = qrcode.QRCode(
        version=1,  # Auto-sizes the matrix
        error_correction=ERROR_CORRECT_M,  # Can recover 15% damaged/scratched stickers!
        box_size=10,  # Size of each square pixel
        border=3,     # White margin border around the QR code
    )

    # 4. Add the URL data
    qr.add_data(target_url)
    qr.make(fit=True)

    # 5. Draw the image (Black squares on clean white background)
    img = qr.make_image(fill_color="black", back_color="white")

    # 6. Save the PNG bytes into RAM using BytesIO (no hard drive files!)
    buffer = io.BytesIO()
    img.save(buffer)
    
    # Return the raw image bytes
    return buffer.getvalue()
