from django.shortcuts import render

apikey = ""
# Create your views here.
def giza(request, city):
    return render(request, "map/giza.html", {
        'city' : city,
        'apikey' : apikey
    })