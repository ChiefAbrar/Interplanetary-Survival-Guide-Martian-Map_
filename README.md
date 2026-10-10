# Interplanetary Survival Guide: Martian Map

Plan a walk on Mars before you take a single step.

This is an interactive map for a Marswalk in Jezero Crater, the same place where NASA's Perseverance rover landed. It pulls several kinds of Mars data into one layered view, so a future explorer can see where to go, what the conditions are like, and what science is waiting along the way. It was built for the NASA Space Apps Challenge.

## What you can do with it

**Switch between map layers.** Look at the terrain, the steepness of the slopes, estimated radiation, and dust, all on the same map of Jezero.

**Plan a route.** Click the map to set a start and a target. The app works out three routes for you: the direct one, the safest one, and the one with the most science. Each shows distance, walking time, the steepest slope, radiation dose, and an elevation profile. Anything steeper than 25 degrees is treated as too dangerous to walk.

**Check conditions on Mars right now.** The clock shows the current local time at Jezero and the current Martian season. You can see temperature, air pressure and dust levels, try out a dust storm, switch on a solar particle event, or jump ahead to a future sol to see how things change.

**Get a straight answer on safety.** Set your suit power, oxygen and water reserves, and the app tells you whether the trip is a go or a no go, and why.

**Find the science.** Delta deposits, olivine rich rock and carbonate margins are marked as targets, and your route shows which ones you pass.

**Use real NASA terrain.** The NASA data tab can load the HiRISE elevation model of Jezero. You can also upload your own elevation file as GeoTIFF, PDS IMG with LBL, CSV or JSON.

## Where the data comes from

The app is built around data from these NASA missions and instruments: MOLA, CTX, HiRISE, CRISM, RAD, MEDA, REMS, THEMIS and GRS. Credit for the HiRISE imagery and terrain goes to NASA JPL Caltech and the University of Arizona.

An honest note: the terrain starts as a synthetic model until you load a real elevation file. Weather, dust and radiation are simple models shaped by what Perseverance and Curiosity have measured, and the interface labels them as modeled. They are not live NASA readings. This is a planning and learning tool, not flight software, and it is not endorsed by NASA.

## Run it on your computer

You need Ruby 3.3 installed.

```
bundle install
bin/rails server
```

Then open http://localhost:3000 in your browser.

## Host it on Render

1. Push this project to a GitHub repository.
2. In Render, choose New, then Blueprint, and pick your repository.
3. Render reads the included `render.yaml` and `Dockerfile`, builds the app and starts it.

The health check lives at `/up` and returns a green response when the app is running properly.

## Built with

Ruby on Rails 7.1, Puma, and plain JavaScript drawing on the HTML canvas. There is no database and nothing to configure beyond the steps above.
