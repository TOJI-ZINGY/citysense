from django.urls import path
from . import views

urlpatterns = [
    path("",views.giza, name = "giza")
]