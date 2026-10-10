#!/usr/bin/env python3
# GrossHub 1-Click Local Server Launcher
# Starts a local HTTP server for desktop and mobile phone devices.

import os
import sys
import socket
import webbrowser
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler

DEFAULT_PORT = 8080
HOST = "0.0.0.0"

# Terminal formatting
ESC = chr(27)
GREEN = ESC + "[92m"
CYAN = ESC + "[96m"
YELLOW = ESC + "[93m"
BOLD = ESC + "[1m"
RESET = ESC + "[0m"

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def is_port_available(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((HOST, port))
            return True
        except OSError:
            return False

def find_available_port(start_port=DEFAULT_PORT, max_attempts=20):
    for port in range(start_port, start_port + max_attempts):
        if is_port_available(port):
            return port
    return None

def open_browser(url, delay=0.5):
    time.sleep(delay)
    try:
        webbrowser.open(url)
    except Exception as e:
        print("Note: Could not open browser automatically (" + str(e) + "). Visit: " + url)

class CustomHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent caching during development so changes appear instantly
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, format, *args):
        sys.stderr.write("[" + time.strftime("%H:%M:%S") + "] " + (format % args) + "\n")

def print_qr_code(url):
    try:
        import qrcode
        qr = qrcode.QRCode(box_size=1, border=1)
        qr.add_data(url)
        qr.make(fit=True)
        print("  " + BOLD + "📱 SCAN TO OPEN ON YOUR MOBILE PHONE:" + RESET)
        print("")
        qr.print_ascii(invert=True)
        print("")
    except Exception:
        pass

def main():
    project_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_dir)

    port = find_available_port(DEFAULT_PORT)
    if not port:
        print(YELLOW + "Error: Ports " + str(DEFAULT_PORT) + "-" + str(DEFAULT_PORT+20) + " are all in use." + RESET)
        sys.exit(1)

    local_ip = get_local_ip()
    local_url = "http://localhost:" + str(port)
    mobile_url = "http://" + local_ip + ":" + str(port)

    print("")
    print(BOLD + GREEN + "======================================================" + RESET)
    print(BOLD + GREEN + "       >> GrossHub Server Running (Mobile + Web) <<   " + RESET)
    print(BOLD + GREEN + "======================================================" + RESET)
    print("")
    print("  💻 " + BOLD + "Desktop Browser:" + RESET + "    " + CYAN + local_url + "/" + RESET)
    print("  📱 " + BOLD + "Mobile Phone URL:" + RESET + "   " + CYAN + mobile_url + "/" + RESET)
    print("  📁 " + BOLD + "Serving Directory:" + RESET + "  " + project_dir)
    print("")
    print("  " + BOLD + "Quick Mobile & Desktop Portal Links:" + RESET)
    print("    * Storefront:      " + CYAN + mobile_url + "/index.html" + RESET)
    print("    * Rider Portal:    " + CYAN + mobile_url + "/rider.html" + RESET + "    (Password: " + YELLOW + "rider123" + RESET + ")")
    print("    * Admin Center:    " + CYAN + mobile_url + "/admin.html" + RESET + "    (Password: " + YELLOW + "grosshub123" + RESET + ")")
    print("")
    print_qr_code(mobile_url + "/")
    print("  💡 " + BOLD + "Tip for Phones:" + RESET + " Ensure your phone is connected to the same Wi-Fi network.")
    print("  " + BOLD + "Press " + YELLOW + "Ctrl + C" + RESET + BOLD + " at any time to stop the server." + RESET)
    print("")

    threading.Thread(target=open_browser, args=(local_url,), daemon=True).start()

    server = HTTPServer((HOST, port), CustomHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("")
        print(YELLOW + "Stopping GrossHub server..." + RESET)
        server.server_close()
        print(GREEN + "Server stopped cleanly. Goodbye!" + RESET)
        print("")

if __name__ == "__main__":
    main()
