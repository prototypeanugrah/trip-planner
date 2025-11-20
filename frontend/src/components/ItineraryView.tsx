import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TripService } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { MapComponent } from './MapComponent';
import {
    Sparkles,
    MapPin,
    Clock,
    Calendar,
    UtensilsCrossed,
    Landmark,
    ShoppingBag,
    Camera,
    Waves,
    Mountain,
    Music,
    Coffee,
    Sun,
    Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Helper function to determine activity icon based on title/description
const getActivityIcon = (activity: any) => {
    const text = `${activity.title} ${activity.description}`.toLowerCase();

    if (text.includes('food') || text.includes('restaurant') || text.includes('lunch') || text.includes('dinner') || text.includes('breakfast') || text.includes('cooking')) {
        return UtensilsCrossed;
    }
    if (text.includes('temple') || text.includes('museum') || text.includes('historic') || text.includes('buddha') || text.includes('palace')) {
        return Landmark;
    }
    if (text.includes('shop') || text.includes('market') || text.includes('bazaar')) {
        return ShoppingBag;
    }
    if (text.includes('photo') || text.includes('view') || text.includes('scenic')) {
        return Camera;
    }
    if (text.includes('beach') || text.includes('swim') || text.includes('ocean') || text.includes('sea')) {
        return Waves;
    }
    if (text.includes('hik') || text.includes('trek') || text.includes('mountain') || text.includes('national park')) {
        return Mountain;
    }
    if (text.includes('music') || text.includes('concert') || text.includes('nightlife') || text.includes('club') || text.includes('bar')) {
        return Music;
    }
    if (text.includes('coffee') || text.includes('cafe')) {
        return Coffee;
    }
    if (text.includes('morning') || text.includes('sunrise')) {
        return Sun;
    }
    if (text.includes('night') || text.includes('evening') || text.includes('sunset')) {
        return Moon;
    }

    return Sparkles;
};

export function ItineraryView({ tripId }: { tripId: string }) {
    const queryClient = useQueryClient();
    const [selectedActivity, setSelectedActivity] = useState<string | null>(null);

    const { data: itinerary, isLoading } = useQuery({
        queryKey: ['itinerary', tripId],
        queryFn: () => TripService.getItinerary(tripId)
    });

    const generateMutation = useMutation({
        mutationFn: () => TripService.generateItinerary(tripId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['itinerary', tripId] });
        }
    });

    if (isLoading) return <div>Loading itinerary...</div>;

    if (!itinerary || itinerary.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-2xl bg-bg-secondary/30">
                <Sparkles className="w-12 h-12 text-text-tertiary mb-4" />
                <h3 className="text-lg font-medium text-text-secondary">No Itinerary Yet</h3>
                <p className="text-text-tertiary text-sm mb-6 max-w-md text-center">
                    Generate a personalized day-by-day plan based on your group's preferences and the finalized location.
                </p>
                <Button
                    onClick={() => generateMutation.mutate()}
                    isLoading={generateMutation.isPending}
                    size="lg"
                >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Itinerary
                </Button>
            </div>
        );
    }

    const allActivities = itinerary.flatMap(day => day.activities || []);

    return (
        <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
            {/* Itinerary List */}
            <div className="w-full md:w-1/2 overflow-y-auto pr-2 space-y-8 h-full">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-text-primary">Itinerary</h2>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => generateMutation.mutate()}
                        isLoading={generateMutation.isPending}
                    >
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        Regenerate
                    </Button>
                </div>

                {/* Days */}
                <div className="space-y-10">
                    {itinerary.map((day: any, dayIdx: number) => (
                        <motion.div
                            key={day.day}
                            className="relative"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: dayIdx * 0.1 }}
                        >
                            {/* Day Header */}
                            <div className="flex items-center gap-4 mb-6 group">
                                {/* Day Number Badge */}
                                <div className="relative">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-blue-hover flex items-center justify-center shadow-lg shadow-accent-blue/20 group-hover:shadow-accent-blue/40 transition-all">
                                        <span className="text-lg font-bold text-white">{day.day}</span>
                                    </div>
                                    {/* Connecting line */}
                                    {dayIdx !== itinerary.length - 1 && (
                                        <div className="absolute top-14 left-1/2 -translate-x-1/2 w-0.5 h-10 bg-gradient-to-b from-accent-blue/50 to-transparent" />
                                    )}
                                </div>

                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-text-primary">Day {day.day}</h3>
                                    <div className="flex items-center gap-2 text-sm text-text-tertiary mt-0.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>{day.date}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Activities */}
                            <div className="ml-7 pl-7 border-l-2 border-border/50 space-y-4">
                                {day.activities.map((activity: any, idx: number) => {
                                    const ActivityIcon = getActivityIcon(activity);
                                    const isSelected = selectedActivity === activity.title;

                                    return (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: dayIdx * 0.1 + idx * 0.05 }}
                                            className="relative"
                                        >
                                            {/* Timeline dot */}
                                            <div className={cn(
                                                "absolute -left-[30px] top-4 w-3 h-3 rounded-full border-2 transition-all",
                                                isSelected
                                                    ? "bg-accent-blue border-accent-blue shadow-lg shadow-accent-blue/50"
                                                    : "bg-bg-primary border-border group-hover:border-accent-blue/50"
                                            )} />

                                            <Card
                                                className={cn(
                                                    "cursor-pointer transition-all duration-300 group overflow-hidden",
                                                    "hover:shadow-lg hover:shadow-accent-blue/10 hover:-translate-y-0.5",
                                                    isSelected
                                                        ? "border-accent-blue ring-2 ring-accent-blue/30 bg-gradient-to-br from-accent-blue/10 to-accent-blue/5 shadow-lg shadow-accent-blue/20"
                                                        : "bg-gradient-to-br from-bg-secondary to-bg-secondary/50 border-border hover:border-accent-blue/50"
                                                )}
                                                onClick={() => setSelectedActivity(activity.title)}
                                            >
                                                <CardContent className="p-4">
                                                    <div className="flex items-start gap-4">
                                                        {/* Icon */}
                                                        <div className={cn(
                                                            "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                                                            isSelected
                                                                ? "bg-accent-blue text-white shadow-lg shadow-accent-blue/30"
                                                                : "bg-bg-tertiary/50 text-accent-blue group-hover:bg-accent-blue/10 group-hover:scale-110"
                                                        )}>
                                                            <ActivityIcon className="w-5 h-5" />
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0 space-y-2">
                                                            <h4 className={cn(
                                                                "font-semibold text-base transition-colors",
                                                                isSelected ? "text-accent-blue" : "text-text-primary group-hover:text-accent-blue"
                                                            )}>
                                                                {activity.title}
                                                            </h4>
                                                            <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">
                                                                {activity.description}
                                                            </p>

                                                            {/* Meta info - Tags, Cost, Duration */}
                                                            <div className="flex flex-wrap items-center gap-2 pt-2">
                                                                {/* Tags */}
                                                                {activity.tags && activity.tags.length > 0 && (
                                                                    activity.tags.map((tag: string, tagIdx: number) => (
                                                                        <div
                                                                            key={tagIdx}
                                                                            className="px-2.5 py-1 rounded-lg bg-bg-tertiary/40 text-xs font-medium text-text-secondary border border-border/50"
                                                                        >
                                                                            {tag}
                                                                        </div>
                                                                    ))
                                                                )}

                                                                {/* Cost */}
                                                                {activity.cost && (
                                                                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent-green/10 text-xs font-semibold text-accent-green border border-accent-green/30">
                                                                        {activity.cost}
                                                                    </div>
                                                                )}

                                                                {/* Duration */}
                                                                {activity.duration && (
                                                                    <div className="flex items-center gap-1.5 bg-bg-tertiary/40 px-2.5 py-1 rounded-lg border border-border/50">
                                                                        <Clock className="w-3.5 h-3.5 text-text-tertiary" />
                                                                        <span className="text-xs font-medium text-text-secondary">{activity.duration}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Map View */}
            <div className="hidden md:block w-1/2 h-full sticky top-0 rounded-2xl overflow-hidden border border-border shadow-2xl bg-bg-secondary">
                <MapComponent
                    activities={allActivities}
                    selectedActivityId={selectedActivity}
                    onActivitySelect={setSelectedActivity}
                />
            </div>
        </div>
    );
}
