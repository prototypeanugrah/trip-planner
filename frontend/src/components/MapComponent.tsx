import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import L from 'leaflet';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
    activities: any[];
    selectedActivityId: string | null;
    onActivitySelect: (id: string) => void;
}

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
}

export function MapComponent({ activities, selectedActivityId, onActivitySelect }: MapComponentProps) {
    // Calculate center based on activities or default to a known location
    const validActivities = activities.filter(a => a.location && a.location.lat && a.location.lng);

    const center: [number, number] = selectedActivityId
        ? (() => {
            const act = activities.find(a => a.title === selectedActivityId); // Assuming title is ID for now
            return act && act.location ? [act.location.lat, act.location.lng] : [0, 0];
        })()
        : (validActivities.length > 0
            ? [validActivities[0].location.lat, validActivities[0].location.lng]
            : [20.5937, 78.9629]); // Default to India center or something neutral

    const zoom = selectedActivityId ? 15 : 12;

    return (
        <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
            <ChangeView center={center} zoom={zoom} />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {validActivities.map((activity, idx) => (
                <Marker
                    key={idx}
                    position={[activity.location.lat, activity.location.lng]}
                    eventHandlers={{
                        click: () => onActivitySelect(activity.title),
                    }}
                >
                    <Popup>
                        <strong>{activity.title}</strong><br />
                        {activity.description}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
