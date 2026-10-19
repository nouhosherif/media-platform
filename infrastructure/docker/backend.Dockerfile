FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY backend/requirements.txt backend/requirements-production.txt ./
RUN pip install --no-cache-dir -r requirements-production.txt
COPY backend/ ./

EXPOSE 8000
CMD ["sh", "-c", "python manage.py collectstatic --noinput --settings=core.settings.production && exec gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 3 --access-logfile -"]
