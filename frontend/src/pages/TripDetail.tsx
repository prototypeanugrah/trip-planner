import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TripService } from '@/services/api';
import type { Participant, Vote } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { AddParticipantWizard } from '@/components/AddParticipantWizard';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import { ItineraryView } from '@/components/ItineraryView';
import { LogisticsView } from '@/components/LogisticsView';
import { Users, Sparkles, Vote as VoteIcon, CheckCircle, ChevronLeft, Calendar, MapPin, MoreVertical, Trash2, Edit2, Check, GripVertical, Trophy, Briefcase, Map } from 'lucide-react';
import { cn, toTitleCase } from '@/lib/utils';
import type { Recommendation } from '@/services/api';
import { SignedIn, SignedOut, RedirectToSignIn, useUser } from "@clerk/clerk-react";

import { ErrorBoundary } from '@/components/ErrorBoundary';

export function TripDetail() {
    console.log("Rendering TripDetail wrapper");
    return (
        <>
            <SignedOut>
                <RedirectToSignIn />
            </SignedOut>
            <SignedIn>
                <ErrorBoundary>
                    <TripDetailContent />
                </ErrorBoundary>
            </SignedIn>
        </>
    );
}



function TripDetailContent() {
    const { tripId } = useParams<{ tripId: string }>();
    const [activeTab, setActiveTab] = useState<'participants' | 'recommendations' | 'voting' | 'preparation'>('participants');
    const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
    const { setIsSidebarCollapsed } = useOutletContext<{ setIsSidebarCollapsed: (collapsed: boolean) => void }>();

    const { data: trip, isLoading: isTripLoading } = useQuery({
        queryKey: ['trip', tripId],
        queryFn: () => TripService.getById(tripId!),
        enabled: !!tripId
    });

    useEffect(() => {
        if (activeTab === 'preparation') {
            setIsSidebarCollapsed(true);
        } else {
            setIsSidebarCollapsed(false);
        }
        return () => setIsSidebarCollapsed(false);
    }, [activeTab, setIsSidebarCollapsed]);

    if (isTripLoading || !trip) {
        return <div className="flex items-center justify-center h-64">Loading...</div>;
    }

    return (
        <div className={cn("h-full flex flex-col", activeTab === 'preparation' ? "" : "space-y-8 pb-20")}>
            {/* Header */}
            <div className={cn("space-y-4", activeTab === 'preparation' ? "px-4 pt-4" : "")}>
                <Link to="/" className="inline-flex items-center text-sm text-text-secondary hover:text-accent-blue transition-colors">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back to Trips
                </Link>
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{trip.name}</h1>
                        <div className="flex items-center gap-3 mt-2 text-sm text-text-secondary">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                <span>{new Date(trip.target_start_date).toLocaleDateString()} - {new Date(trip.target_end_date).toLocaleDateString()}</span>
                            </div>
                            <span className="w-1 h-1 rounded-full bg-text-tertiary" />
                            <span className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-medium border",
                                trip.status === 'voting' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                    trip.status === 'finalized' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                        "bg-text-secondary/10 text-text-secondary border-text-secondary/20"
                            )}>
                                {toTitleCase(trip.status)}
                            </span>
                        </div>
                    </div>

                    {(trip.status === 'voting' || trip.status === 'finalized' || (trip.status === 'draft' && activeTab === 'voting')) && (
                        <Button
                            onClick={() => setActiveTab('preparation')}
                            className={cn(
                                "shadow-lg transition-all",
                                trip.status === 'finalized'
                                    ? "bg-green-600 hover:bg-green-700 text-white shadow-green-500/20"
                                    : "bg-accent-blue hover:bg-accent-blue/90 text-white shadow-accent-blue/20"
                            )}
                        >
                            {trip.status === 'finalized' ? 'View Itinerary' : 'Finalize Location'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className={cn("border-b border-border mt-8", activeTab === 'preparation' ? "px-4" : "")}>
                <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('participants')}
                        className={cn(
                            "flex items-center gap-2 pb-3 text-sm font-medium transition-all relative whitespace-nowrap",
                            activeTab === 'participants' ? "text-accent-blue" : "text-text-secondary hover:text-text-primary"
                        )}
                    >
                        <Users className="w-4 h-4" />
                        Participants
                        {activeTab === 'participants' && (
                            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('recommendations')}
                        className={cn(
                            "flex items-center gap-2 pb-3 text-sm font-medium transition-all relative whitespace-nowrap",
                            activeTab === 'recommendations' ? "text-accent-blue" : "text-text-secondary hover:text-text-primary"
                        )}
                    >
                        <Sparkles className="w-4 h-4" />
                        AI Recommendations
                        {activeTab === 'recommendations' && (
                            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('voting')}
                        className={cn(
                            "flex items-center gap-2 pb-3 text-sm font-medium transition-all relative whitespace-nowrap",
                            activeTab === 'voting' ? "text-accent-blue" : "text-text-secondary hover:text-text-primary"
                        )}
                    >
                        <VoteIcon className="w-4 h-4" />
                        Voting
                        {activeTab === 'voting' && (
                            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
                        )}
                    </button>
                    {(trip.status === 'finalized' || trip.status === 'voting' || trip.status === 'draft') && (
                        <button
                            onClick={() => setActiveTab('preparation')}
                            className={cn(
                                "flex items-center gap-2 pb-3 text-sm font-medium transition-all relative whitespace-nowrap",
                                activeTab === 'preparation' ? "text-accent-blue" : "text-text-secondary hover:text-text-primary"
                            )}
                        >
                            <CheckCircle className="w-4 h-4" />
                            Trip Preparation
                            {activeTab === 'preparation' && (
                                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className={cn("mt-6 animate-fade-in flex-1 min-h-0", activeTab === 'preparation' ? "h-full" : "")}>
                {activeTab === 'participants' && (
                    <ParticipantsView
                        tripId={tripId!}
                        onAddClick={() => setIsAddParticipantOpen(true)}
                    />
                )}
                {activeTab === 'recommendations' && (
                    <RecommendationsView tripId={tripId!} />
                )}
                {activeTab === 'voting' && (
                    <VotingView tripId={tripId!} />
                )}
                {activeTab === 'preparation' && (
                    <PreparationView tripId={tripId!} />
                )}
            </div>

            <AddParticipantWizard
                isOpen={isAddParticipantOpen}
                onClose={() => setIsAddParticipantOpen(false)}
                tripId={tripId!}
            />
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                active
                    ? "border-accent-blue text-accent-blue"
                    : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
            )}
        >
            {icon}
            {label}
        </button>
    )
}

function ParticipantsView({ tripId, onAddClick }: { tripId: string, onAddClick: () => void }) {
    const { user } = useUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress;
    const queryClient = useQueryClient();
    const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [leavingOrganizerId, setLeavingOrganizerId] = useState<string | null>(null);
    const [newOrganizerId, setNewOrganizerId] = useState<string>("");

    const { data: participants, isLoading } = useQuery({
        queryKey: ['participants', tripId],
        queryFn: () => TripService.getParticipants(tripId)
    });

    const deleteMutation = useMutation({
        mutationFn: ({ participantId, userEmail, transferToId }: { participantId: string, userEmail?: string, transferToId?: string }) =>
            TripService.deleteParticipant(tripId, participantId, userEmail, transferToId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['participants', tripId] });
            setTransferModalOpen(false);
            setLeavingOrganizerId(null);
            setNewOrganizerId("");
        },
        onError: (error: any) => {
            alert(error.response?.data?.detail || "Failed to remove participant");
        }
    });

    const handleEditClick = (p: Participant) => {
        setEditingParticipant(p);
        setOpenMenuId(null);
    };

    const handleDeleteClick = (p: Participant) => {
        const isSelf = userEmail && p.email === userEmail;
        // Note: This checks if the CURRENT user is an organizer. 
        // p.role is the role of the participant being deleted.
        // We need to find the current user's participant record to check their role.
        const currentUserParticipant = participants?.find(part => part.email === userEmail);
        const isCurrentUserOrganizer = currentUserParticipant?.role === 'organizer';

        // Check 1: Only person A or organizer can remove A
        if (userEmail && !isSelf && !isCurrentUserOrganizer) {
            alert("You can only remove yourself or, if you are the organizer, other participants.");
            setOpenMenuId(null);
            return;
        }

        // Check 2: Organizer leaving logic
        if (isSelf && p.role === 'organizer') {
            const otherParticipants = participants?.filter(part => part.id !== p.id) || [];
            if (otherParticipants.length === 0) {
                if (confirm("You are the only participant. Do you want to delete the trip instead?")) {
                    TripService.delete(tripId).then(() => {
                        window.location.href = "/";
                    }).catch((err) => {
                        alert("Failed to delete trip: " + (err.response?.data?.detail || err.message));
                    });
                }
                setOpenMenuId(null);
                return;
            } else {
                setLeavingOrganizerId(p.id);
                setTransferModalOpen(true);
                setOpenMenuId(null);
                return;
            }
        }

        if (confirm('Are you sure you want to remove this participant?')) {
            deleteMutation.mutate({ participantId: p.id, userEmail: userEmail || undefined });
        }
        setOpenMenuId(null);
    };

    const handleTransferAndLeave = () => {
        if (!leavingOrganizerId || !newOrganizerId) return;
        deleteMutation.mutate({
            participantId: leavingOrganizerId,
            userEmail: userEmail || undefined,
            transferToId: newOrganizerId
        });
    };

    if (isLoading) return <div>Loading participants...</div>;

    return (
        <>
            <div className="space-y-6" onClick={() => setOpenMenuId(null)}>
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Travel Group</h3>
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); onAddClick(); }}>Add Participant</Button>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-bg-tertiary text-text-secondary font-medium">
                            <tr>
                                <th className="px-4 py-3 font-medium">Name</th>
                                <th className="px-4 py-3 font-medium">Current Location</th>
                                <th className="px-4 py-3 font-medium">Budget</th>
                                <th className="px-4 py-3 font-medium">Preferences</th>
                                <th className="px-4 py-3 font-medium">Date Added</th>
                                <th className="w-[50px]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-bg-secondary">
                            {participants?.map((p) => (
                                <tr key={p.id} className="group hover:bg-bg-tertiary/50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-text-primary">
                                        <div className="flex items-center gap-2">
                                            {p.name}
                                            {p.role === 'organizer' && (
                                                <span className="text-[10px] bg-accent-blue/10 text-accent-blue px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                                                    Organizer
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-text-secondary">
                                        {p.survey_response?.location || <span className="text-text-tertiary">-</span>}
                                    </td>
                                    <td className={cn("px-4 py-3 capitalize",
                                        p.survey_response?.budget === 'low' ? "text-yellow-500" :
                                            p.survey_response?.budget === 'medium' ? "text-green-500" :
                                                p.survey_response?.budget === 'high' ? "text-red-500" :
                                                    "text-text-secondary"
                                    )}>
                                        {p.survey_response?.budget || <span className="text-text-tertiary">-</span>}
                                    </td>
                                    <td className="px-4 py-3 text-text-secondary">
                                        <div className="flex flex-wrap gap-1 max-w-xs">
                                            {p.survey_response?.preferences?.length ? (
                                                p.survey_response.preferences.map(pref => (
                                                    <span key={pref} className="inline-block px-2 py-0.5 text-xs bg-bg-elevated rounded-md border border-border whitespace-nowrap">
                                                        {pref.replace(/_/g, ' ')}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-text-tertiary">-</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-2 py-3 text-right relative">
                                        <div className={cn("opacity-0 group-hover:opacity-100 transition-opacity", openMenuId === p.id && "opacity-100")}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(openMenuId === p.id ? null : p.id);
                                                }}
                                                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {openMenuId === p.id && (
                                                <div className="absolute right-8 top-1/2 -translate-y-1/2 w-32 bg-bg-elevated border border-border rounded-lg shadow-lg py-1 z-10 animate-in fade-in zoom-in-95 duration-100 origin-right">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEditClick(p); }}
                                                        className="w-full px-3 py-2 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-tertiary flex items-center gap-2"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(p); }}
                                                        className="w-full px-3 py-2 text-sm text-left text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {participants?.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                                        No participants yet. Invite friends!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AddParticipantWizard
                isOpen={!!editingParticipant}
                onClose={() => setEditingParticipant(null)}
                tripId={tripId}
                initialData={editingParticipant}
            />

            <Modal
                isOpen={transferModalOpen}
                onClose={() => setTransferModalOpen(false)}
                title="Assign New Organizer"
                description="You must assign a new organizer before leaving the trip."
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Select New Organizer</label>
                        <select
                            className="w-full h-10 rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-blue"
                            value={newOrganizerId}
                            onChange={e => setNewOrganizerId(e.target.value)}
                        >
                            <option value="" disabled>Select person...</option>
                            {participants?.filter(p => p.id !== leavingOrganizerId).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setTransferModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleTransferAndLeave}
                            disabled={!newOrganizerId}
                            isLoading={deleteMutation.isPending}
                        >
                            Transfer Role & Leave
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    )
}

function RecommendationsView({ tripId }: { tripId: string }) {
    const queryClient = useQueryClient();
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [customPreference, setCustomPreference] = useState("");

    const { data: recommendations, isLoading } = useQuery({
        queryKey: ['recommendations', tripId],
        queryFn: () => TripService.getRecommendations(tripId)
    });

    const generateMutation = useMutation({
        mutationFn: (customPref?: string) => TripService.generateRecommendations(tripId, customPref),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recommendations', tripId] });
            setIsGenerateModalOpen(false);
            setCustomPreference("");
        }
    });

    const handleGenerateClick = () => {
        setIsGenerateModalOpen(true);
    };

    if (isLoading) return <div>Loading recommendations...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold">Destination Ideas</h3>
                    <p className="text-sm text-text-secondary">AI-curated based on group preferences</p>
                </div>
                <Button
                    onClick={handleGenerateClick}
                    isLoading={generateMutation.isPending}
                    variant="secondary"
                >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate New
                </Button>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
                {recommendations?.map((rec) => (
                    <Card key={rec.id} className="flex flex-col">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-xl">{rec.title}</CardTitle>
                                <div className="px-2 py-1 bg-bg-tertiary rounded text-xs font-mono">{rec.match_score}% Match</div>
                            </div>
                            <CardDescription className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {rec.destination} • {rec.price_level}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <p className="text-text-secondary text-sm">{rec.description}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {rec.tags.map(tag => (
                                    <span key={tag} className="text-xs bg-accent-blue/10 text-accent-blue px-2 py-1 rounded-md">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {(!recommendations || recommendations.length === 0) && (
                    <div className="col-span-full flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-2xl bg-bg-secondary/30">
                        <Sparkles className="w-8 h-8 text-text-tertiary mb-3" />
                        <p className="text-text-secondary font-medium">No recommendations yet</p>
                        <p className="text-text-tertiary text-sm mb-4">Generate ideas based on everyone's preferences</p>
                        <Button onClick={handleGenerateClick} isLoading={generateMutation.isPending}>
                            Generate Recommendations
                        </Button>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isGenerateModalOpen}
                onClose={() => setIsGenerateModalOpen(false)}
                title="Generate Recommendations"
                description="Personalize your AI travel suggestions."
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="custom-preference" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Custom Preferences (Optional)
                        </label>
                        <Input
                            id="custom-preference"
                            placeholder="e.g., 'Focus on hiking', 'Avoid big cities', 'Budget friendly'"
                            value={customPreference}
                            onChange={(e) => setCustomPreference(e.target.value)}
                        />
                        <p className="text-sm text-text-secondary">
                            Leave blank to generate based on group surveys only.
                        </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setIsGenerateModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => generateMutation.mutate(customPreference)}
                            isLoading={generateMutation.isPending}
                        >
                            Generate
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

function VotingStatus({ participants, votes }: { participants: Participant[], votes: Vote[] }) {
    const votedParticipantIds = new Set(votes?.map(v => v.participant_id) || []);
    const total = participants.length;
    const count = votedParticipantIds.size;
    const missing = participants.filter(p => !votedParticipantIds.has(p.id));

    return (
        <div className="bg-bg-secondary/50 border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">Voting Progress</h4>
                <span className="text-sm text-text-secondary">{count} / {total} voted</span>
            </div>
            <div className="w-full bg-bg-tertiary rounded-full h-2 mb-3 relative overflow-hidden">
                <motion.div
                    className="bg-accent-blue h-2 rounded-full absolute top-0 left-0"
                    initial={{ width: 0 }}
                    animate={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                />
            </div>
            <AnimatePresence mode="wait">
                {missing.length > 0 ? (
                    <motion.div
                        key="waiting"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-xs text-text-secondary"
                    >
                        Waiting for: <span className="font-medium text-text-primary">{missing.map(p => p.name).join(', ')}</span>
                    </motion.div>
                ) : (
                    <motion.div
                        key="done"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="text-xs text-green-600 flex items-center gap-1 font-medium"
                    >
                        <CheckCircle className="w-3 h-3" /> All votes in!
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function VotingView({ tripId }: { tripId: string }) {
    const { user } = useUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress;
    const queryClient = useQueryClient();
    const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
    const [rankings, setRankings] = useState<Recommendation[]>([]);
    const [hasVoted, setHasVoted] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const { data: voteRound } = useQuery({
        queryKey: ['voteRound', tripId],
        queryFn: () => TripService.getVoteRound(tripId)
    });

    const { data: participants } = useQuery({
        queryKey: ['participants', tripId],
        queryFn: () => TripService.getParticipants(tripId)
    });

    const { data: recommendations } = useQuery({
        queryKey: ['recommendations', tripId],
        queryFn: () => TripService.getRecommendations(tripId)
    });

    const { data: results } = useQuery({
        queryKey: ['voteResults', tripId],
        queryFn: () => TripService.getVoteResults(tripId),
        enabled: voteRound?.status === 'closed'
    });

    // Identify current participant based on logged-in user
    const currentParticipant = participants?.find(p => p.email === userEmail);

    // Filter recommendations based on runoff candidates if applicable
    const filteredRecommendations = recommendations
        ? (voteRound?.candidates && voteRound.candidates.length > 0
            ? recommendations.filter(rec => voteRound.candidates!.includes(rec.id))
            : recommendations)
        : [];

    const isRunoffRound = voteRound?.candidates && voteRound.candidates.length > 0;

    useEffect(() => {
        if (currentParticipant) {
            setSelectedParticipantId(currentParticipant.id);
        }
    }, [currentParticipant]);

    useEffect(() => {
        if (filteredRecommendations && rankings.length === 0) {
            setRankings(filteredRecommendations);
        }
    }, [filteredRecommendations, rankings.length]);

    // Reset editing state when participant changes
    useEffect(() => {
        setIsEditing(false);
    }, [selectedParticipantId]);

    // Check if selected participant has already voted
    useEffect(() => {
        // If explicitly editing, don't override the view based on vote existence
        if (isEditing) return;

        if (selectedParticipantId && voteRound?.votes && filteredRecommendations) {
            const existingVote = voteRound.votes.find(v => v.participant_id === selectedParticipantId);
            if (existingVote) {
                setHasVoted(true);
                // Sort rankings based on existing vote
                const sortedRecs = [...filteredRecommendations].sort((a, b) => {
                    const indexA = existingVote.rankings.indexOf(a.id);
                    const indexB = existingVote.rankings.indexOf(b.id);
                    // If a recommendation is new (not in previous vote), put it at the end
                    const rankA = indexA === -1 ? 999 : indexA;
                    const rankB = indexB === -1 ? 999 : indexB;
                    return rankA - rankB;
                });
                setRankings(sortedRecs);
            } else {
                setHasVoted(false);
                // Reset rankings to default order (by score/default) if they haven't voted yet
                setRankings(filteredRecommendations);
            }
        } else if (!selectedParticipantId) {
            setHasVoted(false);
            // Reset rankins when no participant is selected to ensure clean state
            setRankings(filteredRecommendations || []);
        }
    }, [selectedParticipantId, voteRound, filteredRecommendations, isEditing]);

    const submitVoteMutation = useMutation({
        mutationFn: async () => {
            if (!selectedParticipantId) return;
            const formattedRankings = rankings.map((rec, index) => ({
                recommendation_id: rec.id,
                rank: index + 1
            }));
            await TripService.submitVote(tripId, selectedParticipantId, formattedRankings, userEmail);
        },
        onSuccess: () => {
            setHasVoted(true);
            setIsEditing(false);
            queryClient.invalidateQueries({ queryKey: ['voteRound', tripId] });
        }
    });

    const endVotingMutation = useMutation({
        mutationFn: () => TripService.getVoteResults(tripId),
        onSuccess: (data) => {
            queryClient.setQueryData(['voteResults', tripId], data);
            queryClient.invalidateQueries({ queryKey: ['voteRound', tripId] });
        }
    });

    if (!voteRound || !recommendations || !participants) {
        return <div className="py-12 text-center text-text-secondary">Loading voting session...</div>;
    }

    if (voteRound.status === 'closed' || (results && results.vote_round.status === 'closed')) {
        const winnerId = results?.vote_round?.results?.winner || "";
        const rounds = results?.vote_round?.results?.rounds || [];
        const votes = results?.vote_round?.votes || [];

        return (
            <div className="space-y-12 max-w-4xl mx-auto animate-fade-in">
                <div className="text-center space-y-4">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", duration: 0.8 }}
                        className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto shadow-xl"
                    >
                        <Trophy className="w-10 h-10" />
                    </motion.div>
                    <div>
                        <h3 className="text-3xl font-bold tracking-tight">Voting Complete!</h3>
                        <p className="text-text-secondary text-lg">The tribe has spoken.</p>
                    </div>
                </div>

                {/* Leaderboard Section */}
                <LocationLeaderboard
                    winnerId={winnerId}
                    rounds={rounds}
                    recommendations={recommendations}
                    votes={votes}
                />

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Voting Breakdown */}
                    <div className="space-y-4">
                        <h4 className="text-xl font-semibold flex items-center gap-2">
                            <VoteIcon className="w-5 h-5" />
                            Round-by-Round Breakdown
                        </h4>
                        <div className="space-y-4">
                            {rounds.map((round: Record<string, number>, index: number) => (
                                <Card key={index} className="overflow-hidden">
                                    <CardHeader className="py-3 bg-bg-tertiary/50">
                                        <CardTitle className="text-sm font-medium">Round {index + 1}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        <div className="space-y-3">
                                            {Object.entries(round)
                                                .sort(([, a], [, b]) => (b as number) - (a as number))
                                                .map(([recId, count]) => {
                                                    const rec = recommendations.find(r => r.id === recId);
                                                    const totalVotes = Object.values(round).reduce((a: number, b: number) => a + b, 0);
                                                    const percentage = ((count as number) / totalVotes) * 100;

                                                    return (
                                                        <div key={recId} className="space-y-1">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="font-medium">{rec?.title || 'Unknown'}</span>
                                                                <span className="text-text-secondary">{String(count)} votes</span>
                                                            </div>
                                                            <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${percentage}%` }}
                                                                    transition={{ duration: 1, delay: 0.2 }}
                                                                    className={cn(
                                                                        "h-full rounded-full",
                                                                        recId === winnerId ? "bg-yellow-500" : "bg-accent-blue"
                                                                    )}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* User Rankings */}
                    <div className="space-y-4">
                        <h4 className="text-xl font-semibold flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Group Rankings
                        </h4>
                        <div className="grid gap-3">
                            {[...votes].sort((a, b) => {
                                const rankA = a.rankings.indexOf(winnerId);
                                const rankB = b.rankings.indexOf(winnerId);
                                const effectiveRankA = rankA === -1 ? 999 : rankA;
                                const effectiveRankB = rankB === -1 ? 999 : rankB;
                                return effectiveRankA - effectiveRankB;
                            }).map((vote: Vote) => {
                                const participant = participants.find(p => p.id === vote.participant_id);
                                const topChoices = vote.rankings.slice(0, 2).map(id => recommendations.find(r => r.id === id));

                                return (
                                    <motion.div
                                        key={vote.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-bg-elevated border border-border rounded-lg p-4 shadow-sm"
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-8 h-8 rounded-full bg-accent-blue/10 text-accent-blue flex items-center justify-center font-bold text-xs">
                                                {participant?.name.charAt(0)}
                                            </div>
                                            <span className="font-medium">{participant?.name}</span>
                                        </div>
                                        <div className="space-y-2">
                                            {topChoices.map((choice, idx) => (
                                                <div
                                                    key={choice?.id || idx}
                                                    className={cn(
                                                        "flex items-center gap-3 p-2 rounded-md text-sm",
                                                        choice?.id === winnerId
                                                            ? "bg-yellow-50 border border-yellow-200 text-yellow-800"
                                                            : "bg-bg-tertiary text-text-secondary"
                                                    )}
                                                >
                                                    <span className={cn(
                                                        "w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold",
                                                        choice?.id === winnerId ? "bg-yellow-200 text-yellow-800" : "bg-bg-secondary text-text-tertiary"
                                                    )}>
                                                        {idx + 1}
                                                    </span>
                                                    <span className="truncate">{choice?.title}</span>
                                                    {choice?.id === winnerId && <Trophy className="w-3 h-3 ml-auto text-yellow-600" />}
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>
        );
    }

    // Check if all votes are in
    const allVotesIn = voteRound && participants && voteRound.votes.length === participants.length && participants.length > 0;

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <VotingStatus participants={participants} votes={voteRound.votes} />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold">Cast Your Vote</h3>
                    <p className="text-sm text-text-secondary">
                        {isRunoffRound
                            ? `Runoff vote: Choose between the top ${filteredRecommendations.length} destinations.`
                            : "Rank the destinations from most to least favorite."
                        }
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary whitespace-nowrap">Voting as:</span>
                    {currentParticipant ? (
                        <div className="h-9 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm font-medium flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-accent-blue/10 text-accent-blue flex items-center justify-center text-xs">
                                {currentParticipant.name.charAt(0)}
                            </div>
                            {currentParticipant.name}
                        </div>
                    ) : (
                        <div className="h-9 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-600 flex items-center gap-2">
                            Not a participant
                        </div>
                    )}
                </div>
            </div>

            {hasVoted ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 bg-bg-secondary/30 rounded-xl border border-border border-dashed">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                        <Check className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold">Vote Submitted!</h3>
                        {!allVotesIn && (
                            <p className="text-text-secondary max-w-md mt-2">
                                Waiting for other participants to cast their votes.
                            </p>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setIsEditing(true);
                                setHasVoted(false);
                            }}
                        >
                            Edit Vote
                        </Button>
                        {allVotesIn && (
                            currentParticipant?.role === 'organizer' ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                >
                                    <Button
                                        variant="secondary"
                                        onClick={() => endVotingMutation.mutate()}
                                        isLoading={endVotingMutation.isPending}
                                    >
                                        End Voting & Show Results
                                    </Button>
                                </motion.div>
                            ) : (
                                <p className="text-sm text-text-secondary self-center italic">
                                    Please wait for the organizer to end voting and show results.
                                </p>
                            )
                        )}
                    </div>
                </div>
            ) : !selectedParticipantId ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-xl bg-bg-secondary/30">
                    <VoteIcon className="w-8 h-8 text-text-tertiary mb-3" />
                    <p className="text-text-secondary font-medium">
                        {currentParticipant ? "Loading your session..." : "You must be a participant to vote."}
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    <Reorder.Group axis="y" values={rankings} onReorder={setRankings} className="space-y-3">
                        {rankings.map((rec, index) => (
                            <Reorder.Item key={rec.id} value={rec}>
                                <div className="flex items-center gap-4 p-4 bg-bg-elevated border border-border rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-accent-blue/50 transition-colors select-none">
                                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-bg-tertiary rounded-full font-bold text-text-secondary">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-medium">{rec.title}</h4>
                                        <p className="text-sm text-text-secondary line-clamp-1">{rec.description}</p>
                                    </div>
                                    <GripVertical className="text-text-tertiary" />
                                </div>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>

                    <div className="flex justify-end pt-4">
                        <Button
                            size="lg"
                            onClick={() => submitVoteMutation.mutate()}
                            isLoading={submitVoteMutation.isPending}
                            className="w-full sm:w-auto"
                        >
                            Submit Ranking
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function LocationLeaderboard({ winnerId, rounds, recommendations, votes }: { winnerId: string, rounds: Record<string, number>[], recommendations: Recommendation[], votes: Vote[] }) {
    // Calculate top 3
    const getTop3 = () => {
        const finalRound = rounds[rounds.length - 1] || {};
        const candidates = new Set<string>();
        rounds.forEach(r => Object.keys(r).forEach(k => candidates.add(k)));

        const sortedCandidates = Array.from(candidates).sort((a, b) => {
            // If one is winner, it comes first
            if (a === winnerId) return -1;
            if (b === winnerId) return 1;

            // Check which round they were eliminated in
            const roundIndexA = rounds.findIndex(r => !r[a]);
            const roundIndexB = rounds.findIndex(r => !r[b]);

            // If both survived to the end (or same round), compare votes in their last active round
            if (roundIndexA === -1 && roundIndexB === -1) {
                return (finalRound[b] || 0) - (finalRound[a] || 0);
            }

            // The one who lasted longer is better
            if (roundIndexA !== roundIndexB) {
                const effectiveA = roundIndexA === -1 ? 999 : roundIndexA;
                const effectiveB = roundIndexB === -1 ? 999 : roundIndexB;
                return effectiveB - effectiveA;
            }

            // If eliminated in same round, compare votes in the round BEFORE they were eliminated
            // Or just compare votes in the last round they both existed
            const lastCommonRoundIdx = (roundIndexA === -1 ? rounds.length : roundIndexA) - 1;
            if (lastCommonRoundIdx >= 0) {
                const round = rounds[lastCommonRoundIdx];
                const diff = (round[b] || 0) - (round[a] || 0);
                if (diff !== 0) return diff;
            }

            // Tie-breaker: Compare total "points" from raw votes (Borda count style)
            // Rank 1 = 1.0, Rank 2 = 0.5, Rank 3 = 0.33, etc.
            const getScore = (id: string) => {
                return votes.reduce((score, vote) => {
                    const rank = vote.rankings.indexOf(id);
                    if (rank === -1) return score;
                    return score + (1 / (rank + 1));
                }, 0);
            };

            const scoreA = getScore(a);
            const scoreB = getScore(b);
            return scoreB - scoreA;
        });

        return sortedCandidates.slice(0, 3).map(id => recommendations.find(r => r.id === id));
    };

    const top3 = getTop3();
    const [first, second, third] = top3;

    return (
        <div className="relative pt-8 pb-4 px-4">
            <div className="flex justify-center items-end gap-4 h-64">
                {/* Second Place */}
                {second && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-col items-center w-1/3 max-w-[160px]"
                    >
                        <div className="mb-2 text-center">
                            <span className="text-sm font-bold text-text-secondary block line-clamp-1">{second.title}</span>
                        </div>
                        <div className="w-full bg-slate-200 h-32 rounded-t-lg relative group">
                            <div className="absolute inset-0 bg-gradient-to-b from-slate-300/50 to-transparent rounded-t-lg" />
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-4xl font-bold text-slate-400 opacity-50">2</div>
                        </div>
                    </motion.div>
                )}

                {/* First Place */}
                {first && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center w-1/3 max-w-[180px] z-10 -mx-2"
                    >
                        <div className="mb-2 text-center">
                            <Sparkles className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                            <span className="text-base font-bold text-text-primary block line-clamp-1">{first.title}</span>
                        </div>
                        <div className="w-full bg-yellow-300 h-48 rounded-t-lg relative shadow-lg flex flex-col items-center justify-start pt-6">
                            <div className="absolute inset-0 bg-gradient-to-b from-yellow-200 to-transparent rounded-t-lg" />
                            <Trophy className="w-10 h-10 text-yellow-600 drop-shadow-sm z-10 mb-1" />
                            <div className="text-5xl font-bold text-yellow-600 opacity-50 z-10">1</div>
                        </div>
                    </motion.div>
                )}

                {/* Third Place */}
                {third && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="flex flex-col items-center w-1/3 max-w-[160px]"
                    >
                        <div className="mb-2 text-center">
                            <span className="text-sm font-bold text-text-secondary block line-clamp-1">{third.title}</span>
                        </div>
                        <div className="w-full bg-orange-100 h-24 rounded-t-lg relative">
                            <div className="absolute inset-0 bg-gradient-to-b from-orange-200/50 to-transparent rounded-t-lg" />
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-4xl font-bold text-orange-300 opacity-50">3</div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}

function PreparationView({ tripId }: { tripId: string }) {
    const [activeTab, setActiveTab] = useState<'itinerary' | 'logistics' | 'packing'>('itinerary');

    return (
        <div className="h-full flex flex-col animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 flex-none">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Trip Preparation</h2>
                    <p className="text-text-secondary">Get ready for your upcoming adventure!</p>
                </div>

                <div className="flex bg-bg-tertiary p-1 rounded-lg self-start md:self-auto">
                    <button
                        onClick={() => setActiveTab('itinerary')}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                            activeTab === 'itinerary'
                                ? "bg-bg-elevated text-text-primary shadow-sm"
                                : "text-text-secondary hover:text-text-primary"
                        )}
                    >
                        <Map className="w-4 h-4" />
                        Itinerary
                    </button>
                    <button
                        onClick={() => setActiveTab('logistics')}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                            activeTab === 'logistics'
                                ? "bg-bg-elevated text-text-primary shadow-sm"
                                : "text-text-secondary hover:text-text-primary"
                        )}
                    >
                        <Briefcase className="w-4 h-4" />
                        Travel Logistics
                    </button>
                    <button
                        onClick={() => setActiveTab('packing')}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                            activeTab === 'packing'
                                ? "bg-bg-elevated text-text-primary shadow-sm"
                                : "text-text-secondary hover:text-text-primary"
                        )}
                    >
                        <Briefcase className="w-4 h-4" />
                        Packing Trip
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                {activeTab === 'itinerary' ? (
                    <ItineraryView tripId={tripId} />
                ) : activeTab === 'logistics' ? (
                    <LogisticsView tripId={tripId} />
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Briefcase className="w-5 h-5 text-accent-blue" />
                                Packing List
                            </CardTitle>
                            <CardDescription>Collaborative packing list for the group</CardDescription>
                        </CardHeader>
                        <CardContent className="min-h-[300px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border/50 rounded-lg m-6 bg-bg-secondary/30">
                            <Briefcase className="w-12 h-12 text-text-tertiary mb-4 opacity-50" />
                            <h3 className="text-lg font-medium text-text-secondary">Packing List Coming Soon</h3>
                            <p className="text-sm text-text-tertiary max-w-sm mt-2">
                                We're building a smart packing list feature to help you ensure nothing gets left behind.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
