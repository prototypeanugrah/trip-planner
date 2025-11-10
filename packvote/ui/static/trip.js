// API Configuration
const API_BASE_URL = '/api';

// Get trip ID from URL
const urlParams = new URLSearchParams(window.location.search);
const tripId = urlParams.get('id');

// DOM Elements
let currentTrip = null;
let participants = [];
let recommendations = [];
let tripMenuListenerAttached = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    if (!tripId) {
        window.location.href = '/ui';
        return;
    }

    await loadTripData();
    await loadSidebarTrips();
    setupEventListeners();
    setupWorkflowSteps();
});

// Load all trip data
async function loadTripData() {
    try {
        // Load trip details
        currentTrip = await fetchTrip();
        displayTripInfo();

        // Load participants
        participants = await fetchParticipants();
        await displayParticipants();

        // Load recommendations
        recommendations = await fetchRecommendations();
        displayRecommendations();

    } catch (error) {
        console.error('Error loading trip data:', error);
        showError('Failed to load trip data');
    }
}

// Fetch trip details
async function fetchTrip() {
    const response = await fetch(`${API_BASE_URL}/trips/${tripId}`);
    if (!response.ok) throw new Error('Failed to fetch trip');
    return await response.json();
}

// Fetch participants
async function fetchParticipants() {
    const response = await fetch(`${API_BASE_URL}/trips/${tripId}/participants`);
    if (!response.ok) return [];
    return await response.json();
}

// Fetch recommendations
async function fetchRecommendations() {
    const response = await fetch(`${API_BASE_URL}/trips/${tripId}/recommendations`);
    if (!response.ok) return [];
    return await response.json();
}

// Fetch all trips for sidebar
async function fetchAllTrips() {
    const response = await fetch(`${API_BASE_URL}/trips`);
    if (!response.ok) return [];
    return await response.json();
}

// Load and display trips in sidebar
async function loadSidebarTrips() {
    try {
        const trips = await fetchAllTrips();
        displaySidebarTrips(trips);
        setupTripMenuHandlers();
    } catch (error) {
        console.error('Error loading sidebar trips:', error);
        const container = document.getElementById('sidebarTripsList');
        container.innerHTML = '<div class="trips-loading">Failed to load trips</div>';
    }
}

// Display trips in sidebar
function displaySidebarTrips(trips) {
    const container = document.getElementById('sidebarTripsList');

    if (trips.length === 0) {
        container.innerHTML = '<div class="trips-loading">No trips yet</div>';
        return;
    }

    container.innerHTML = trips.map(trip => {
        const isActive = trip.id === tripId;

        return `
            <div class="trip-item ${isActive ? 'active' : ''}" data-trip-id="${trip.id}">
                <a href="/ui/trip.html?id=${trip.id}" class="trip-item-link">
                    <div class="trip-item-name">${escapeHtml(trip.name)}</div>
                    <div class="trip-item-meta">
                        <span class="trip-status-dot"></span>
                        <span>${capitalize(trip.status)}</span>
                    </div>
                </a>
                <div class="trip-menu-wrapper">
                    <button class="trip-menu-btn" type="button" data-trip-id="${trip.id}" aria-label="Trip actions" aria-expanded="false">
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="4" r="1.5" fill="currentColor" />
                            <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                            <circle cx="10" cy="16" r="1.5" fill="currentColor" />
                        </svg>
                    </button>
                    <div class="trip-menu" role="menu" data-trip-id="${trip.id}">
                        <button type="button" class="trip-menu-delete" data-trip-id="${trip.id}">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Display trip information
function displayTripInfo() {
    document.getElementById('tripName').textContent = currentTrip.name;
    document.getElementById('tripStatus').textContent = currentTrip.status;
    document.getElementById('organizerName').textContent = currentTrip.organizer_name;

    if (currentTrip.target_start_date && currentTrip.target_end_date) {
        const startDate = formatDate(currentTrip.target_start_date);
        const endDate = formatDate(currentTrip.target_end_date);
        document.getElementById('travelDates').textContent = `${startDate} - ${endDate}`;

        const duration = calculateDuration(currentTrip.target_start_date, currentTrip.target_end_date);
        document.getElementById('tripDuration').textContent = `${duration} days`;
    }
}

// Display participants
async function displayParticipants() {
    const container = document.getElementById('participantsList');

    console.log('displayParticipants called with', participants.length, 'participants');

    if (!container) {
        console.error('participantsList container not found!');
        return;
    }

    if (participants.length === 0) {
        container.innerHTML = '<div class="empty-state-small"><p>No participants yet</p></div>';
        return;
    }

    try {
        // Fetch survey responses for all participants
        const participantsWithData = await Promise.all(participants.map(async (p) => {
            try {
                // Try to fetch their survey response
                const response = await fetch(`${API_BASE_URL}/trips/${tripId}/participants/${p.id}/survey-response`);
                if (response.ok) {
                    const surveyData = await response.json();
                    console.log('Survey data for', p.name, ':', surveyData.answers);
                    return { ...p, surveyData: surveyData.answers || {} };
                } else {
                    console.log('No survey response for', p.name, '(', response.status, ')');
                }
            } catch (e) {
                console.log('Error fetching survey for participant', p.name, ':', e.message);
            }
            return { ...p, surveyData: {} };
        }));

        console.log('Participants with data:', participantsWithData);

        const tableHTML = `
            <div class="participants-table">
                <div class="table-header">
                    <div class="table-cell">NAME</div>
                    <div class="table-cell">LOCATION</div>
                    <div class="table-cell">BUDGET</div>
                    <div class="table-cell">PREFERENCES</div>
                    <div class="table-cell">DATE ADDED</div>
                </div>
                ${participantsWithData.map(p => {
                    const location = p.surveyData.location || '-';
                    const budget = p.surveyData.budget || '-';
                    const preferences = p.surveyData.preferences || [];
                    const dateAdded = formatDateTime(p.created_at);

                    const budgetClass = budget === 'low' ? 'budget-low' : budget === 'medium' ? 'budget-medium' : budget === 'high' ? 'budget-high' : '';

                    const preferenceTags = preferences.length > 0
                        ? preferences.map(pref => `<span class="preference-tag">${formatPreference(pref)}</span>`).join('')
                        : '<span class="text-muted">-</span>';

                    return `
                        <div class="table-row">
                            <div class="table-cell participant-name-cell">${escapeHtml(p.name)}</div>
                            <div class="table-cell">${escapeHtml(location)}</div>
                            <div class="table-cell"><span class="budget-badge ${budgetClass}">${capitalize(budget)}</span></div>
                            <div class="table-cell preferences-cell">${preferenceTags}</div>
                            <div class="table-cell">${dateAdded}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        console.log('About to set innerHTML, tableHTML length:', tableHTML.length);
        container.innerHTML = tableHTML;
        console.log('Successfully set innerHTML');
    } catch (error) {
        console.error('Error displaying participants:', error);
        // Fallback to basic rendering without survey data
        container.innerHTML = `
            <div class="participants-table">
                <div class="table-header">
                    <div class="table-cell">NAME</div>
                    <div class="table-cell">PHONE</div>
                    <div class="table-cell">ROLE</div>
                    <div class="table-cell">DATE ADDED</div>
                </div>
                ${participants.map(p => `
                    <div class="table-row">
                        <div class="table-cell participant-name-cell">${escapeHtml(p.name)}</div>
                        <div class="table-cell">${escapeHtml(p.phone)}</div>
                        <div class="table-cell">${escapeHtml(p.role)}</div>
                        <div class="table-cell">${formatDateTime(p.created_at)}</div>
                    </div>
                `).join('')}
            </div>
            <div class="error-message" style="margin-top: 12px; padding: 12px; background: rgba(255, 59, 48, 0.1); border-radius: 8px; color: #ff3b30;">
                Could not load survey data. Showing basic participant info.
            </div>
        `;
    }
}

// Display recommendations
function displayRecommendations() {
    const container = document.getElementById('recommendationsList');

    if (recommendations.length === 0) {
        container.innerHTML = '<div class="empty-state-small"><p>No recommendations generated yet</p></div>';
        return;
    }

    container.innerHTML = recommendations.map(r => `
        <div class="recommendation-item">
            <h4>${escapeHtml(r.title)}</h4>
            <p>${escapeHtml(r.description)}</p>
        </div>
    `).join('');
}

// Setup event listeners
function setupEventListeners() {
    // Sidebar controls
    document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);
    document.getElementById('sidebarNewTrip')?.addEventListener('click', () => {
        window.location.href = '/ui';
    });

    // Participant modal
    document.getElementById('addParticipantBtn')?.addEventListener('click', showAddParticipantModal);
    document.getElementById('cancelParticipantBtn')?.addEventListener('click', hideAddParticipantModal);
    document.getElementById('addParticipantForm')?.addEventListener('submit', handleAddParticipant);

    // Phone validation
    const phoneInput = document.getElementById('participantPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', validatePhoneNumber);
        phoneInput.addEventListener('blur', validatePhoneNumber);
    }

    // Close modal on overlay click
    document.getElementById('addParticipantModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'addParticipantModal') {
            hideAddParticipantModal();
        }
    });

    document.getElementById('generateRecommendationsBtn')?.addEventListener('click', async () => {
        await generateRecommendations();
    });

    document.getElementById('startVotingBtn')?.addEventListener('click', () => {
        alert('Start voting functionality coming soon!');
    });

    document.getElementById('finalizeTripBtn')?.addEventListener('click', async () => {
        await finalizeTrip();
    });
}

// Setup workflow step toggles
function setupWorkflowSteps() {
    document.querySelectorAll('.step-header').forEach(header => {
        header.addEventListener('click', () => {
            const step = header.parentElement;
            step.classList.toggle('active');
        });
    });

    // Auto-expand first step
    document.querySelector('.workflow-step')?.classList.add('active');
}

// Generate recommendations
async function generateRecommendations() {
    try {
        const btn = document.getElementById('generateRecommendationsBtn');
        btn.disabled = true;
        btn.textContent = 'Generating...';

        const response = await fetch(`${API_BASE_URL}/trips/${tripId}/recommendations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidate_count: 5 })
        });

        if (!response.ok) throw new Error('Failed to generate recommendations');

        recommendations = await response.json();
        displayRecommendations();

        btn.textContent = 'Generate Recommendations';
        btn.disabled = false;
    } catch (error) {
        console.error('Error generating recommendations:', error);
        showError('Failed to generate recommendations');
        document.getElementById('generateRecommendationsBtn').disabled = false;
    }
}

// Modal controls
function showAddParticipantModal() {
    const modal = document.getElementById('addParticipantModal');
    modal.classList.add('active');
    setTimeout(() => {
        document.getElementById('participantName')?.focus();
    }, 300);
}

function hideAddParticipantModal() {
    const modal = document.getElementById('addParticipantModal');
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.classList.remove('active');
        modal.style.opacity = '1';
        document.getElementById('addParticipantForm').reset();
    }, 200);
}

// Validate phone number
function validatePhoneNumber(e) {
    const phoneInput = e.target;
    const phoneError = document.getElementById('phoneError');
    const originalValue = phoneInput.value;
    const phoneValue = originalValue.replace(/\D/g, ''); // Remove non-digits

    // Check if there are non-digit characters
    if (originalValue.length > 0 && originalValue !== phoneValue) {
        phoneError.textContent = 'Only digits (0-9) are allowed in phone number';
        phoneError.style.display = 'block';
        phoneInput.setCustomValidity('Only digits are allowed');
        return;
    }

    if (phoneValue.length > 10) {
        const extraDigits = phoneValue.length - 10;
        phoneError.textContent = `Only 10 digits should be there. You have entered ${extraDigits} extra digit${extraDigits > 1 ? 's' : ''}`;
        phoneError.style.display = 'block';
        phoneInput.setCustomValidity('Phone number must be exactly 10 digits');
    } else {
        phoneError.style.display = 'none';
        phoneInput.setCustomValidity('');
    }
}

// Handle add participant
async function handleAddParticipant(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);

    // Validate phone number before submission
    const phoneInput = document.getElementById('participantPhone');
    const phoneValue = phoneInput.value.replace(/\D/g, '');
    if (phoneValue.length !== 10) {
        phoneInput.focus();
        return;
    }

    // Collect preferences (checkboxes)
    const preferences = [];
    form.querySelectorAll('input[name="preferences"]:checked').forEach(checkbox => {
        preferences.push(checkbox.value);
    });

    // Combine country code and phone number
    const countryCode = formData.get('country_code');
    const phoneNumber = phoneValue; // Use validated phone value
    const fullPhone = `${countryCode}${phoneNumber}`;

    const participantData = {
        name: formData.get('name'),
        phone: fullPhone,
        email: null, // Not collected in this form
        role: 'traveler', // Default role
        timezone: null, // Could be inferred from location later
    };

    try {
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';

        const response = await fetch(`${API_BASE_URL}/trips/${tripId}/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(participantData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to add participant');
        }

        const newParticipant = await response.json();

        // Submit survey response with preferences data
        const surveyData = {
            answers: {
                location: formData.get('location') || '',
                budget: formData.get('budget') || '',
                preferences: preferences
            }
        };

        try {
            const surveyResponse = await fetch(
                `${API_BASE_URL}/trips/${tripId}/participants/${newParticipant.id}/survey-response`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(surveyData)
                }
            );

            if (!surveyResponse.ok) {
                console.error('Failed to save survey response, but participant was added');
            }
        } catch (surveyError) {
            console.error('Error saving survey response:', surveyError);
        }

        // Add to local array and refresh display
        participants.push(newParticipant);
        await displayParticipants();

        // Refresh sidebar to show updated participant count (future enhancement)
        await loadSidebarTrips();

        // Close modal
        hideAddParticipantModal();

        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Participant';
    } catch (error) {
        console.error('Error adding participant:', error);
        showError(error.message || 'Failed to add participant');
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Participant';
    }
}

function setupTripMenuHandlers() {
    const menuButtons = document.querySelectorAll('.trip-menu-btn');
    menuButtons.forEach(button => {
        button.addEventListener('click', handleTripMenuToggle);
    });

    document.querySelectorAll('.trip-menu').forEach(menu => {
        menu.addEventListener('click', (event) => event.stopPropagation());
    });

    document.querySelectorAll('.trip-menu-delete').forEach(button => {
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const targetTripId = button.dataset.tripId;
            await handleTripDelete(targetTripId);
        });
    });

    if (!tripMenuListenerAttached) {
        document.addEventListener('click', closeAllTripMenus);
        tripMenuListenerAttached = true;
    }
}

function handleTripMenuToggle(event) {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    const wrapper = button.closest('.trip-menu-wrapper');
    if (!wrapper) return;
    const menu = wrapper.querySelector('.trip-menu');
    if (!menu) return;

    const isOpen = menu.classList.contains('open');
    closeAllTripMenus();
    if (!isOpen) {
        menu.classList.add('open');
        button.setAttribute('aria-expanded', 'true');
    }
}

function closeAllTripMenus() {
    document.querySelectorAll('.trip-menu').forEach(menu => menu.classList.remove('open'));
    document.querySelectorAll('.trip-menu-btn').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
}

async function handleTripDelete(targetTripId) {
    if (!targetTripId) {
        return;
    }

    const confirmed = confirm('Delete this trip? This action cannot be undone.');
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/trips/${targetTripId}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error('Failed to delete trip');
        }
        closeAllTripMenus();
        if (targetTripId === tripId) {
            window.location.href = '/ui';
            return;
        }
        await loadSidebarTrips();
    } catch (error) {
        console.error('Error deleting trip:', error);
        showError(error.message || 'Failed to delete trip');
    }
}

// Finalize trip
async function finalizeTrip() {
    if (!confirm('Are you sure you want to finalize this trip? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/trips/${tripId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'finalized' })
        });

        if (!response.ok) throw new Error('Failed to finalize trip');

        currentTrip = await response.json();
        displayTripInfo();
        alert('Trip finalized successfully!');
    } catch (error) {
        console.error('Error finalizing trip:', error);
        showError('Failed to finalize trip');
    }
}

// Toggle sidebar on mobile
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function calculateDuration(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    alert(message); // TODO: Replace with better error UI
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatPreference(pref) {
    return pref.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function capitalize(str) {
    if (!str || str === '-') return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}
