import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TripService, type FlightRecommendation, type HotelRecommendation } from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useUser } from '@clerk/clerk-react';
import { Plane, Hotel, Clock, MapPin, Star, ChevronDown, ChevronUp, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface LogisticsViewProps {
    tripId: string;
}

export function LogisticsView({ tripId }: LogisticsViewProps) {
    const { user } = useUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress || '';
    const queryClient = useQueryClient();
    const [isGenerating, setIsGenerating] = useState(false);

    const { data: logistics, isLoading, error } = useQuery({
        queryKey: ['travelLogistics', tripId, userEmail],
        queryFn: () => TripService.getTravelLogistics(tripId, userEmail),
        enabled: !!userEmail
    });

    const generateMutation = useMutation({
        mutationFn: () => TripService.generateTravelLogistics(tripId, userEmail),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['travelLogistics', tripId, userEmail] });
            setIsGenerating(false);
        },
        onError: (err) => {
            console.error('Generate logistics error:', err);
            setIsGenerating(false);
        }
    });

    const handleGenerate = () => {
        setIsGenerating(true);
        generateMutation.mutate();
    };

    const hasLogistics = logistics && (
        (logistics.outbound_flights && logistics.outbound_flights.length > 0) ||
        (logistics.return_flights && logistics.return_flights.length > 0) ||
        (logistics.hotels && logistics.hotels.length > 0)
    );

    if (isLoading) {
        return <div className="py-12 text-center text-text-secondary">Loading logistics...</div>;
    }

    if (!hasLogistics) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Plane className="w-5 h-5 text-accent-blue" />
                        Travel Logistics
                    </CardTitle>
                    <CardDescription>AI-powered flight and hotel recommendations</CardDescription>
                </CardHeader>
                <CardContent className="min-h-[300px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border/50 rounded-lg m-6 bg-bg-secondary/30">
                    <Sparkles className="w-12 h-12 text-accent-blue mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-text-primary mb-2">Generate Your Travel Plan</h3>
                    <p className="text-sm text-text-tertiary max-w-sm mb-6">
                        Get personalized flight and hotel recommendations based on your preferences and budget.
                    </p>
                    <Button
                        onClick={handleGenerate}
                        isLoading={isGenerating || generateMutation.isPending}
                        disabled={!userEmail}
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Recommendations
                    </Button>
                    {error && (
                        <p className="text-sm text-red-600 mt-4">
                            Error loading logistics. Please try regenerating.
                        </p>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6 flex-none">
                <div>
                    <h3 className="text-lg font-semibold">Your Travel Logistics</h3>
                    <p className="text-sm text-text-secondary">Personalized recommendations for your trip</p>
                </div>
                <Button
                    onClick={handleGenerate}
                    isLoading={isGenerating || generateMutation.isPending}
                    variant="secondary"
                    size="sm"
                >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Regenerate
                </Button>
            </div>

            {/* Two-column layout with scrolling */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="grid md:grid-cols-2 gap-6 pb-6">
                    {/* Flights Column */}
                    <FlightSection
                        outboundFlights={logistics.outbound_flights || []}
                        returnFlights={logistics.return_flights || []}
                    />

                    {/* Hotels Column */}
                    <HotelSection hotels={logistics.hotels || []} />
                </div>
            </div>
        </div>
    );
}

function FlightSection({ outboundFlights, returnFlights }: {
    outboundFlights: FlightRecommendation[];
    returnFlights: FlightRecommendation[];
}) {
    const [showOutboundAlternatives, setShowOutboundAlternatives] = useState(false);
    const [showReturnAlternatives, setShowReturnAlternatives] = useState(false);
    const [selectedFlight, setSelectedFlight] = useState<FlightRecommendation | null>(null);

    const bestOutbound = outboundFlights[0];
    const alternativeOutbound = outboundFlights.slice(1);
    const bestReturn = returnFlights[0];
    const alternativeReturn = returnFlights.slice(1);

    const hasFlights = outboundFlights.length > 0 || returnFlights.length > 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <Plane className="w-5 h-5 text-accent-blue" />
                <h4 className="font-semibold text-lg">Flight Recommendations</h4>
            </div>

            {!hasFlights ? (
                <div className="text-center py-8 text-text-secondary">
                    <Plane className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No flight recommendations available</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Best Outbound Flight */}
                    {bestOutbound && (
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-text-secondary uppercase tracking-wide">
                                Outbound Flight
                            </div>
                            <FlightCard
                                flight={bestOutbound}
                                isBest
                                onClick={() => setSelectedFlight(bestOutbound)}
                            />

                            {/* Show alternatives toggle */}
                            {alternativeOutbound.length > 0 && (
                                <div>
                                    <button
                                        onClick={() => setShowOutboundAlternatives(!showOutboundAlternatives)}
                                        className="flex items-center gap-2 text-sm text-accent-blue hover:underline"
                                    >
                                        {showOutboundAlternatives ? (
                                            <>
                                                <ChevronUp className="w-4 h-4" />
                                                Hide {alternativeOutbound.length} alternative{alternativeOutbound.length > 1 ? 's' : ''}
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown className="w-4 h-4" />
                                                View {alternativeOutbound.length} alternative{alternativeOutbound.length > 1 ? 's' : ''}
                                            </>
                                        )}
                                    </button>

                                    <AnimatePresence>
                                        {showOutboundAlternatives && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="space-y-3 mt-3 overflow-hidden"
                                            >
                                                {alternativeOutbound.map((flight) => (
                                                    <FlightCard
                                                        key={flight.id}
                                                        flight={flight}
                                                        onClick={() => setSelectedFlight(flight)}
                                                    />
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Best Return Flight */}
                    {bestReturn && (
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-text-secondary uppercase tracking-wide">
                                Return Flight
                            </div>
                            <FlightCard
                                flight={bestReturn}
                                isBest
                                onClick={() => setSelectedFlight(bestReturn)}
                            />

                            {/* Show alternatives toggle */}
                            {alternativeReturn.length > 0 && (
                                <div>
                                    <button
                                        onClick={() => setShowReturnAlternatives(!showReturnAlternatives)}
                                        className="flex items-center gap-2 text-sm text-accent-blue hover:underline"
                                    >
                                        {showReturnAlternatives ? (
                                            <>
                                                <ChevronUp className="w-4 h-4" />
                                                Hide {alternativeReturn.length} alternative{alternativeReturn.length > 1 ? 's' : ''}
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown className="w-4 h-4" />
                                                View {alternativeReturn.length} alternative{alternativeReturn.length > 1 ? 's' : ''}
                                            </>
                                        )}
                                    </button>

                                    <AnimatePresence>
                                        {showReturnAlternatives && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="space-y-3 mt-3 overflow-hidden"
                                            >
                                                {alternativeReturn.map((flight) => (
                                                    <FlightCard
                                                        key={flight.id}
                                                        flight={flight}
                                                        onClick={() => setSelectedFlight(flight)}
                                                    />
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Flight Details Modal */}
            <Modal
                isOpen={!!selectedFlight}
                onClose={() => setSelectedFlight(null)}
                title="Flight Details"
            >
                {selectedFlight && <FlightDetails flight={selectedFlight} />}
            </Modal>
        </div>
    );
}

function HotelSection({ hotels }: { hotels: HotelRecommendation[] }) {
    const [showAlternatives, setShowAlternatives] = useState(false);
    const [selectedHotel, setSelectedHotel] = useState<HotelRecommendation | null>(null);

    const bestHotel = hotels[0];
    const alternatives = hotels.slice(1);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <Hotel className="w-5 h-5 text-accent-blue" />
                <h4 className="font-semibold text-lg">Hotel Recommendations</h4>
            </div>

            {!bestHotel ? (
                <div className="text-center py-8 text-text-secondary">
                    <Hotel className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hotel recommendations available</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <HotelCard
                        hotel={bestHotel}
                        isBest
                        onClick={() => setSelectedHotel(bestHotel)}
                    />

                    {/* Show alternatives toggle */}
                    {alternatives.length > 0 && (
                        <div>
                            <button
                                onClick={() => setShowAlternatives(!showAlternatives)}
                                className="flex items-center gap-2 text-sm text-accent-blue hover:underline"
                            >
                                {showAlternatives ? (
                                    <>
                                        <ChevronUp className="w-4 h-4" />
                                        Hide {alternatives.length} alternative{alternatives.length > 1 ? 's' : ''}
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="w-4 h-4" />
                                        View {alternatives.length} alternative{alternatives.length > 1 ? 's' : ''}
                                    </>
                                )}
                            </button>

                            <AnimatePresence>
                                {showAlternatives && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-3 mt-3 overflow-hidden"
                                    >
                                        {alternatives.map((hotel) => (
                                            <HotelCard
                                                key={hotel.id}
                                                hotel={hotel}
                                                onClick={() => setSelectedHotel(hotel)}
                                            />
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            )}

            {/* Hotel Details Modal */}
            <Modal
                isOpen={!!selectedHotel}
                onClose={() => setSelectedHotel(null)}
                title="Hotel Details"
            >
                {selectedHotel && <HotelDetails hotel={selectedHotel} />}
            </Modal>
        </div>
    );
}

// Simplified Flight Card - Only airline+logo, price, to/from
function FlightCard({ flight, isBest = false, onClick }: {
    flight: FlightRecommendation;
    isBest?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full border rounded-lg p-3 transition-all bg-bg-elevated text-left",
                "hover:border-accent-blue hover:shadow-md cursor-pointer",
                isBest ? "border-accent-blue shadow-sm" : "border-border"
            )}
        >
            {isBest && (
                <div className="text-xs font-semibold text-accent-blue mb-2 uppercase tracking-wide">
                    Best Option
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                    {flight.airline_logo_url && (
                        <img src={flight.airline_logo_url} alt={flight.airline} className="w-8 h-8 object-contain flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{flight.airline}</div>
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                            <span className="truncate">{flight.departure_airport}</span>
                            <ArrowRight className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{flight.arrival_airport}</span>
                        </div>
                    </div>
                </div>
                <div className="text-right ml-3">
                    <div className="text-xl font-bold text-accent-blue whitespace-nowrap">${flight.price_usd}</div>
                </div>
            </div>
        </button>
    );
}

// Simplified Hotel Card - Only name, total price, stars, location
function HotelCard({ hotel, isBest = false, onClick }: {
    hotel: HotelRecommendation;
    isBest?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full border rounded-lg p-3 transition-all bg-bg-elevated text-left",
                "hover:border-accent-blue hover:shadow-md cursor-pointer",
                isBest ? "border-accent-blue shadow-sm" : "border-border"
            )}
        >
            {isBest && (
                <div className="text-xs font-semibold text-accent-blue mb-2 uppercase tracking-wide">
                    Best Option
                </div>
            )}

            <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold mb-1 truncate">{hotel.name}</h4>
                    <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: hotel.star_rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                        ))}
                    </div>
                    <div className="flex items-start gap-1 text-xs text-text-secondary">
                        <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{hotel.address}</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xl font-bold text-accent-blue whitespace-nowrap">${hotel.total_price_usd}</div>
                    <div className="text-xs text-text-tertiary">total</div>
                </div>
            </div>
        </button>
    );
}

function FlightDetails({ flight }: { flight: FlightRecommendation }) {
    const formatDateTime = (isoString: string) => {
        const date = new Date(isoString);
        return {
            time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        };
    };

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    const departure = formatDateTime(flight.departure_time);
    const arrival = formatDateTime(flight.arrival_time);

    return (
        <div className="space-y-6">
            {/* Airline Info */}
            <div className="flex items-center gap-4">
                {flight.airline_logo_url && (
                    <img src={flight.airline_logo_url} alt={flight.airline} className="w-16 h-16 object-contain" />
                )}
                <div>
                    <h3 className="text-xl font-bold">{flight.airline}</h3>
                    <p className="text-text-secondary">Flight {flight.flight_number}</p>
                </div>
            </div>

            {/* Flight Details */}
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="text-sm text-text-secondary mb-1">Departure</div>
                        <div className="text-2xl font-bold">{departure.time}</div>
                        <div className="text-sm text-text-secondary">{departure.date}</div>
                        <div className="font-medium mt-1">{flight.departure_airport}</div>
                    </div>
                    <div>
                        <div className="text-sm text-text-secondary mb-1">Arrival</div>
                        <div className="text-2xl font-bold">{arrival.time}</div>
                        <div className="text-sm text-text-secondary">{arrival.date}</div>
                        <div className="font-medium mt-1">{flight.arrival_airport}</div>
                    </div>
                </div>

                <div className="border-t border-border pt-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-sm text-text-secondary mb-1">Duration</div>
                            <div className="font-semibold">{formatDuration(flight.duration_minutes)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-text-secondary mb-1">Stops</div>
                            <div className="font-semibold">
                                {flight.num_stops === 0 ? 'Direct' : `${flight.num_stops} stop${flight.num_stops > 1 ? 's' : ''}`}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-text-secondary mb-1">Price</div>
                            <div className="font-bold text-accent-blue text-xl">${flight.price_usd}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function HotelDetails({ hotel }: { hotel: HotelRecommendation }) {
    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="space-y-6">
            {/* Hotel Header */}
            <div>
                <h3 className="text-2xl font-bold mb-2">{hotel.name}</h3>
                <div className="flex items-center gap-2 mb-3">
                    {Array.from({ length: hotel.star_rating }).map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="text-sm text-text-secondary ml-2">{hotel.star_rating} Star Hotel</span>
                </div>
                <div className="flex items-start gap-2 text-text-secondary">
                    <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                    <span>{hotel.address}</span>
                </div>
            </div>

            {/* Pricing */}
            <div className="bg-bg-secondary/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-text-secondary">Price per night</span>
                    <span className="text-xl font-bold">${hotel.price_per_night_usd}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-text-secondary">{hotel.num_nights} night{hotel.num_nights > 1 ? 's' : ''}</span>
                    <span className="text-text-secondary">${hotel.price_per_night_usd} × {hotel.num_nights}</span>
                </div>
                <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-bold text-accent-blue">${hotel.total_price_usd}</span>
                </div>
            </div>

            {/* Dates */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-text-secondary" />
                    <div>
                        <div className="text-sm text-text-secondary">Check-in</div>
                        <div className="font-medium">{formatDate(hotel.check_in_date)}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-text-secondary" />
                    <div>
                        <div className="text-sm text-text-secondary">Check-out</div>
                        <div className="font-medium">{formatDate(hotel.check_out_date)}</div>
                    </div>
                </div>
            </div>

            {/* Amenities */}
            {hotel.amenities && hotel.amenities.length > 0 && (
                <div>
                    <h4 className="font-semibold mb-3">Amenities</h4>
                    <div className="flex flex-wrap gap-2">
                        {hotel.amenities.map((amenity, idx) => (
                            <span
                                key={idx}
                                className="text-sm bg-bg-tertiary text-text-primary px-3 py-1.5 rounded-md border border-border"
                            >
                                {amenity}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
