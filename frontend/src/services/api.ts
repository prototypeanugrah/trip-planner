import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add response interceptor for error handling if needed
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // You could add a toast notification here
    console.error("API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Types
export interface Trip {
  id: string;
  name: string;
  description: string;
  organizer_name: string;
  organizer_email?: string;
  organizer_phone?: string;
  target_start_date: string;
  target_end_date: string;
  status: "draft" | "voting" | "finalized" | "completed";
  created_at: string;
  updated_at: string;
}

export interface CreateTripRequest {
  name: string;
  description?: string;
  organizer_name: string;
  organizer_phone: string;
  organizer_email?: string;
  target_start_date: string;
  target_end_date: string;
  tags?: string[];
}

export interface Participant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: "organizer" | "traveler";
  trip_id: string;
  created_at: string;
  survey_response?: {
    location?: string;
    budget?: string;
    preferences?: string[];
  };
}

export interface CreateParticipantRequest {
  name: string;
  phone?: string;
  email?: string;
  role?: "organizer" | "traveler";
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  destination: string;
  match_score: number;
  price_level: string;
  tags: string[];
}

interface RecommendationResponse {
  id: string;
  title: string;
  description: string;
  score?: number;
  cost_usd?: number;
  extra?: {
    highlights?: string[];
    vibe?: string;
    estimated_cost?: number;
    confidence?: number;
  };
}

export interface FlightRecommendation {
  id: string;
  rank: number;
  airline: string;
  airline_logo_url?: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  price_usd: number;
  duration_minutes: number;
  num_stops: number;
}

export interface HotelRecommendation {
  id: string;
  rank: number;
  name: string;
  star_rating: number;
  check_in_date: string;
  check_out_date: string;
  num_nights: number;
  price_per_night_usd: number;
  total_price_usd: number;
  address: string;
  amenities: string[];
}

export interface TravelLogistics {
  outbound_flights: FlightRecommendation[];
  return_flights: FlightRecommendation[];
  hotels: HotelRecommendation[];
  metadata?: Record<string, any>;
}

// Service functions
export const TripService = {
  getAll: async (email?: string) => {
    const params = email ? { email } : {};
    const response = await api.get<Trip[]>("/trips", { params });
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get<Trip>(`/trips/${id}`);
    return response.data;
  },
  create: async (data: CreateTripRequest) => {
    const response = await api.post<Trip>("/trips", data);
    return response.data;
  },
  update: async (id: string, data: Partial<CreateTripRequest>) => {
    const response = await api.patch<Trip>(`/trips/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/trips/${id}`);
  },
  getParticipants: async (tripId: string) => {
    const response = await api.get<Participant[]>(`/trips/${tripId}/participants`);
    return response.data;
  },
  addParticipant: async (tripId: string, data: CreateParticipantRequest) => {
    const response = await api.post<Participant>(`/trips/${tripId}/participants`, data);
    return response.data;
  },
  inviteParticipant: async (tripId: string, data: { email?: string; phone?: string }) => {
    const response = await api.post<{ message: string }>(`/trips/${tripId}/invite`, data);
    return response.data;
  },
  joinTrip: async (tripId: string, data: { name: string; phone?: string; email?: string; preferences: string[]; budget: string; location?: string }) => {
    const response = await api.post<Participant>(`/trips/${tripId}/join`, data);
    return response.data;
  },
  updateParticipant: async (tripId: string, participantId: string, data: Partial<CreateParticipantRequest>) => {
    const response = await api.patch<Participant>(`/trips/${tripId}/participants/${participantId}`, data);
    return response.data;
  },
  deleteParticipant: async (tripId: string, participantId: string, userEmail?: string, transferToId?: string) => {
    const headers = userEmail ? { "x-user-email": userEmail } : {};
    const params = transferToId ? { transfer_organizer_to: transferToId } : {};
    await api.delete(`/trips/${tripId}/participants/${participantId}`, { headers, params });
  },
  saveSurveyResponse: async (tripId: string, participantId: string, answers: Record<string, unknown>) => {
    const response = await api.patch(`/trips/${tripId}/participants/${participantId}/survey-response`, { answers });
    return response.data;
  },
  getSurveyResponse: async (tripId: string, participantId: string) => {
    try {
      const response = await api.get(`/trips/${tripId}/participants/${participantId}/survey-response`);
      return response.data;
    } catch {
      return null;
    }
  },
  getRecommendations: async (tripId: string) => {
    const response = await api.get<RecommendationResponse[]>(`/trips/${tripId}/recommendations`);
    return response.data.map(mapRecommendation);
  },
  generateRecommendations: async (tripId: string, customPreference?: string) => {
    const response = await api.post<RecommendationResponse[]>(`/trips/${tripId}/recommendations`, {
      candidate_count: 5,
      custom_preference: customPreference
    });
    return response.data.map(mapRecommendation);
  },
  getVoteRound: async (tripId: string) => {
    const response = await api.get<VoteRound>(`/trips/${tripId}/vote-rounds/current`);
    return response.data;
  },
  submitVote: async (tripId: string, participantId: string, rankings: { recommendation_id: string; rank: number }[], userEmail?: string) => {
    const headers = userEmail ? { "x-user-email": userEmail } : {};
    const response = await api.post(`/trips/${tripId}/votes`, {
      participant_id: participantId,
      rankings
    }, { headers });
    return response.data;
  },
  getVoteResults: async (tripId: string) => {
    const response = await api.get<VoteResults>(`/trips/${tripId}/results`);
    return response.data;
  },
  generateItinerary: async (tripId: string) => {
    const response = await api.post<any[]>(`/trips/${tripId}/itinerary/generate`);
    return response.data;
  },
  getItinerary: async (tripId: string) => {
    const response = await api.get<any[]>(`/trips/${tripId}/itinerary`);
    return response.data;
  },
  getTravelLogistics: async (tripId: string, userEmail: string) => {
    const response = await api.get<TravelLogistics>(`/trips/${tripId}/logistics`, {
      params: { user_email: userEmail }
    });
    return response.data;
  },
  generateTravelLogistics: async (tripId: string, userEmail: string) => {
    const response = await api.post<TravelLogistics>(
      `/trips/${tripId}/logistics/generate?user_email=${encodeURIComponent(userEmail)}`,
      {}
    );
    return response.data;
  }
};

export interface Vote {
  id: string;
  vote_round_id: string;
  participant_id: string;
  rankings: string[];
  created_at: string;
  updated_at: string;
}

export interface VoteRound {
  id: string;
  trip_id: string;
  status: "open" | "closed";
  candidates?: string[] | null;  // For runoff rounds, restricts which recommendations can be voted on
  results?: {
    winner?: string;
    rounds?: Record<string, number>[];
  };
  votes: Vote[];
}

export interface VoteResults {
  vote_round: VoteRound;
  recommendations: RecommendationResponse[];
}


const mapRecommendation = (rec: RecommendationResponse): Recommendation => {
  const details = rec.extra || {};
  const highlights = Array.isArray(details.highlights) ? details.highlights : [];
  const vibe = details.vibe ? [details.vibe] : [];

  let priceLevel = "$$";
  const cost = details.estimated_cost || rec.cost_usd;
  if (cost) {
    if (cost < 1000) priceLevel = "$";
    else if (cost < 2500) priceLevel = "$$";
    else if (cost < 4000) priceLevel = "$$$";
    else priceLevel = "$$$$";
  }

  return {
    id: rec.id,
    title: rec.title,
    description: rec.description,
    destination: rec.title, // Fallback to title as destination
    match_score: Math.round((rec.score || details.confidence || 0) * 100),
    price_level: priceLevel,
    tags: [...highlights, ...vibe]
  };
};
