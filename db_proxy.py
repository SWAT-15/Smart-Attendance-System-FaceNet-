import socket
import threading
import sys

def forward(src, dst):
    try:
        while True:
            data = src.recv(4096)
            if not data:
                break
            dst.sendall(data)
    except:
        pass
    finally:
        try:
            src.close()
        except:
            pass
        try:
            dst.close()
        except:
            pass

def handle_client(client_socket, remote_host, remote_port):
    try:
        # Resolve to IPv6 addresses
        addr_info = socket.getaddrinfo(remote_host, remote_port, socket.AF_INET6, socket.SOCK_STREAM)
        if not addr_info:
            print("Could not resolve remote IPv6 address.")
            client_socket.close()
            return
        
        remote_addr = addr_info[0][4]
        
        # Connect to remote over IPv6
        remote_socket = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        remote_socket.connect(remote_addr)
    except Exception as e:
        print(f"Proxy Connection Error: {e}")
        try:
            client_socket.close()
        except:
            pass
        return

    # Forward in both directions
    threading.Thread(target=forward, args=(client_socket, remote_socket), daemon=True).start()
    threading.Thread(target=forward, args=(remote_socket, client_socket), daemon=True).start()

def main():
    listen_host = "127.0.0.1"  # Bind to localhost
    listen_port = 5433         # Listen on port 5433
    remote_host = "db.hsuhqjtsiiofnxurcmrs.supabase.co"
    remote_port = 5432

    # Listen on IPv4
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    try:
        server.bind((listen_host, listen_port))
    except Exception as e:
        print(f"Failed to bind to port {listen_port}: {e}")
        sys.exit(1)
        
    server.listen(10)
    print(f"Local IPv4 proxy listening on {listen_host}:{listen_port} -> IPv6 {remote_host}:{remote_port}")

    try:
        while True:
            client, addr = server.accept()
            threading.Thread(target=handle_client, args=(client, remote_host, remote_port), daemon=True).start()
    except KeyboardInterrupt:
        print("Shutting down proxy...")
    finally:
        server.close()

if __name__ == "__main__":
    main()
