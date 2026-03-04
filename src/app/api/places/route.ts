import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  let name = `${parseFloat(lat).toFixed(4)}°, ${parseFloat(lng).toFixed(4)}°`;
  let photoUrl: string | null = null;

  if (googleKey) {
    const nearbyRes = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleKey,
        "X-Goog-FieldMask": "places.displayName,places.photos",
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
            radius: 2000,
          },
        },
        maxResultCount: 1,
      }),
    });

    const nearbyData = await nearbyRes.json();
    const place = nearbyData.places?.[0];

    if (place) {
      if (place.displayName?.text) name = place.displayName.text;
      const photoName = place.photos?.[0]?.name;
      if (photoName) {
        photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=600&key=${googleKey}`;
      }
    }
  }

  if (name.includes("°") && mapboxToken) {
    const geoRes = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&language=es`
    );
    const geoData = await geoRes.json();
    if (geoData.features?.[0]?.place_name) name = geoData.features[0].place_name;
  }

  return NextResponse.json({ name, photoUrl });
}
