#!/usr/bin/env bash
# Affiche les salons et les joueurs connectés : ./who.sh   (en continu : watch -n 5 ./who.sh)
curl -fsS --max-time 5 http://127.0.0.1:3000/admin/who || echo "✘ le site ne répond pas sur 127.0.0.1:3000 (docker compose logs app)"
