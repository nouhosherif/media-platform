from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from common.health import health, ready

urlpatterns = [
    path('health/', health, name='health'),
    path('ready/', ready, name='ready'),
    path('admin/', admin.site.urls),
    path('api/users/', include('apps.users.urls')),
    path('api/media/', include('apps.media_handler.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
