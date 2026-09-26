#!/bin/bash
# The Keycloak image ships without curl or wget, so this speaks HTTP over bash's /dev/tcp.
exec 3<>/dev/tcp/localhost/9000
printf 'GET /health/ready HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&3
timeout 5 grep -q '"status": *"UP"' <&3
