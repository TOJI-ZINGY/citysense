from django.shortcuts import render

# Render the map page. We no longer use the Google Maps API key; the
# frontend uses Leaflet + Nominatim (OpenStreetMap) instead.
def giza(request):
    return render(request, "map/giza.html")