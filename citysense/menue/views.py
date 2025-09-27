from django.shortcuts import render , redirect

# Create your views here.

ITEMS = ["item1", "item2", "item3"]
def choice(request):
    if request.method == "POST":
        selected_item = request.POST.get("selected_item")
        if selected_item == "item1":
            return redirect('map:giza', city = ITEMS[0])
        elif selected_item == "item2":
            return redirect("map:giza", city = ITEMS[1])
        else:
            return redirect("map:giza",city = ITEMS[2])
    return render(request, "menue/choice.html",{"items":ITEMS})
