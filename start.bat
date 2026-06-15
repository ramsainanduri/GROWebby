@echo off
where docker >nul 2>nul
if errorlevel 1 (
  echo Docker is required. Install Docker Desktop and try again.
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo Docker Compose v2 is required. Update Docker Desktop and try again.
  exit /b 1
)

if not exist .env (
  echo No .env found. Using the default CPU Docker engine profile on Windows.
  > .env echo GROWEBBY_ENGINE=windows-cpu
  >> .env echo COMPOSE_PROFILES=cpu
  >> .env echo GROMACS_EXECUTION_MODE=docker-cpu
  >> .env echo GROMACS_BINARY=
)

docker compose up --build -d

echo Waiting for backend to initialize...
timeout /t 5 /nobreak >nul
docker compose exec backend python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.create_superuser('admin', 'admin@growebby.local', 'admin') if not User.objects.filter(username='admin').exists() else None"

start http://localhost:5173
echo GROWebby is starting at http://localhost:5173
