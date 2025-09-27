from django.urls import path
from . import views

urlpatterns = [
    path("<str:city>",views.giza, name = "giza")
]