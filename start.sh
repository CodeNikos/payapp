#!/bin/bash
set -e
cd backend
python seed.py
exec uvicorn app.main:app --host 0.0.0.0 --port 80
