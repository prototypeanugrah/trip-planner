// API Configuration
const API_BASE_URL = '/api';

// DOM Elements
const modalOverlay = document.getElementById('modalOverlay');
const mainContent = document.getElementById('mainContent');
const createTripForm = document.getElementById('createTripForm');
const cancelBtn = document.getElementById('cancelBtn');
const newTripBtn = document.getElementById('newTripBtn');
const decrementBtn = document.getElementById('decrementBtn');
const incrementBtn = document.getElementById('incrementBtn');
const durationInput = document.getElementById('durationDays');
const tripsList = document.getElementById('tripsList');
const modeCreateBtn = document.getElementById('modalModeCreate');
const modeExistingBtn = document.getElementById('modalModeExisting');
const modalCreateSection = document.getElementById('modalCreateSection');
const modalExistingSection = document.getElementById('modalExistingSection');
const modalExistingTrips = document.getElementById('modalExistingTrips');
const modalExistingEmpty = document.getElementById('modalExistingEmpty');
const closeExistingBtn = document.getElementById('closeExistingBtn');
const projectNameInput = document.getElementById('projectName');

// State Management
let cachedTrips = [];
let currentModalMode = 'create';

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await checkExistingTrips();
});

// Event Listeners Setup
function setupEventListeners() {
    // Form submission
    createTripForm.addEventListener('submit', handleFormSubmit);

    // Modal controls
    cancelBtn.addEventListener('click', handleCancel);
    newTripBtn.addEventListener('click', () => showModal('create'));
    modeCreateBtn?.addEventListener('click', () => switchModalMode('create'));
    modeExistingBtn?.addEventListener('click', () => switchModalMode('existing'));
    closeExistingBtn?.addEventListener('click', hideModal);

    // Duration controls
    decrementBtn.addEventListener('click', () => updateDuration(-1));
    incrementBtn.addEventListener('click', () => updateDuration(1));
    durationInput.addEventListener('input', handleDurationInput);

    // Phone validation
    const organizerPhoneInput = document.getElementById('organizerPhone');
    if (organizerPhoneInput) {
        organizerPhoneInput.addEventListener('input', validateOrganizerPhone);
        organizerPhoneInput.addEventListener('blur', validateOrganizerPhone);
    }

    // Close modal on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay && cachedTrips.length > 0) {
            hideModal();
        }
    });
}

// Check if user has existing trips
async function checkExistingTrips() {
    try {
        cachedTrips = await fetchTrips();
        displayTrips(cachedTrips);
        renderExistingTrips(cachedTrips);
    } catch (error) {
        console.error('Error checking trips:', error);
        cachedTrips = [];
        renderExistingTrips(cachedTrips, error);
    } finally {
        showModal('create');
    }
}

// Fetch trips from API
async function fetchTrips() {
    const response = await fetch(`${API_BASE_URL}/trips`);

    if (!response.ok) {
        throw new Error('Failed to fetch trips');
    }

    return await response.json();
}

// Display trips in the list
function displayTrips(trips) {
    if (trips.length === 0) {
        tripsList.innerHTML = `
            <div class="empty-state">
                <h2>No trips yet</h2>
                <p>Create your first trip to get started!</p>
            </div>
        `;
        return;
    }

    tripsList.innerHTML = trips.map(trip => `
        <div class="trip-card" onclick="viewTrip('${trip.id}')">
            <h3>${escapeHtml(trip.name)}</h3>
            ${trip.description ? `<p>${escapeHtml(trip.description)}</p>` : ''}
            <div class="trip-meta">
                <span>Status: ${trip.status}</span>
                ${trip.target_start_date ? `<span>Start: ${formatDate(trip.target_start_date)}</span>` : ''}
                ${trip.target_end_date ? `<span>End: ${formatDate(trip.target_end_date)}</span>` : ''}
            </div>
        </div>
    `).join('');
}

function renderExistingTrips(trips, error) {
    if (!modalExistingTrips || !modalExistingEmpty) return;

    if (error) {
        modalExistingEmpty.querySelector('h2').textContent = 'Unable to load trips';
        modalExistingEmpty.querySelector('p').textContent = 'Please try again later or refresh.';
    } else {
        modalExistingEmpty.querySelector('h2').textContent = 'No trips yet';
        modalExistingEmpty.querySelector('p').textContent = 'Create your first trip to get started.';
    }

    if (!trips || trips.length === 0) {
        modalExistingEmpty.classList.remove('hidden');
        modalExistingTrips.innerHTML = '';
        return;
    }

    modalExistingEmpty.classList.add('hidden');
    modalExistingTrips.innerHTML = trips
        .map(trip => `
            <div class="existing-trip-card">
                <div>
                    <h3>${escapeHtml(trip.name)}</h3>
                    ${trip.description ? `<p>${escapeHtml(trip.description)}</p>` : ''}
                    <div class="existing-trip-meta">
                        Status: ${capitalize(trip.status)}
                        ${trip.target_start_date ? ` • Start: ${formatDate(trip.target_start_date)}` : ''}
                    </div>
                </div>
                <button class="btn btn-secondary existing-trip-open" data-trip-id="${trip.id}">
                    Open
                </button>
            </div>
        `)
        .join('');

    modalExistingTrips.querySelectorAll('.existing-trip-open').forEach(button => {
        button.addEventListener('click', () => {
            const tripId = button.dataset.tripId;
            if (tripId) {
                viewTrip(tripId);
            }
        });
    });
}

// Validate organizer phone number
function validateOrganizerPhone(e) {
    const phoneInput = e.target;
    const phoneError = document.getElementById('organizerPhoneError');
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

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();

    // Clear any previous error messages
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    // Validate phone number before submission
    const organizerPhoneInput = document.getElementById('organizerPhone');
    const phoneValue = organizerPhoneInput.value.replace(/\D/g, '');
    if (phoneValue.length !== 10) {
        organizerPhoneInput.focus();
        return;
    }

    // Get form data
    const formData = new FormData(createTripForm);
    const projectName = formData.get('name');
    const organizerName = formData.get('organizer_name');
    const organizerPhone = phoneValue; // Use validated phone value
    const organizerEmail = formData.get('organizer_email');
    const startDate = formData.get('target_start_date');
    const durationDays = parseInt(formData.get('duration_days'));
    const organizerLocation = formData.get('organizer_location') || '';
    const organizerBudget = formData.get('organizer_budget') || '';
    const organizerPreferences = formData.getAll('organizer_preferences') || [];

    // Calculate end date
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(startDateTime);
    endDateTime.setDate(endDateTime.getDate() + durationDays);

    // Prepare trip data
    const tripData = {
        name: projectName,
        description: `${durationDays}-day trip starting ${formatDate(startDate)}`,
        organizer_name: organizerName,
        organizer_phone: organizerPhone,
        organizer_email: organizerEmail || null,
        target_start_date: startDateTime.toISOString(),
        target_end_date: endDateTime.toISOString(),
        tags: []
    };

    try {
        // Disable submit button
        const submitBtn = createTripForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        // Create trip via API
        const response = await fetch(`${API_BASE_URL}/trips`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tripData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create trip');
        }

        const newTrip = await response.json();

        await saveOrganizerPreferences(newTrip.id, {
            location: organizerLocation,
            budget: organizerBudget,
            preferences: organizerPreferences,
        });

        // Redirect to trip detail page
        window.location.href = `/ui/trip.html?id=${newTrip.id}`;

    } catch (error) {
        console.error('Error creating trip:', error);

        // Show error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = error.message || 'Failed to create trip. Please try again.';
        createTripForm.insertBefore(errorDiv, createTripForm.firstChild);

        // Re-enable submit button
        const submitBtn = createTripForm.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Project';
    }
}

// Handle cancel button
function handleCancel() {
    if (cachedTrips.length === 0) {
        createTripForm.reset();
        durationInput.value = 3;
    } else {
        hideModal();
    }
}

// Duration controls with haptic-like feedback
function updateDuration(change) {
    const currentValue = parseInt(durationInput.value);
    const newValue = Math.max(1, Math.min(60, currentValue + change));

    // Add subtle animation
    durationInput.style.transform = 'scale(1.05)';
    setTimeout(() => {
        durationInput.style.transform = 'scale(1)';
    }, 100);

    durationInput.value = newValue;
}

function handleDurationInput(e) {
    let value = parseInt(e.target.value);
    if (isNaN(value) || value < 1) {
        value = 1;
    } else if (value > 60) {
        value = 60;
    }
    e.target.value = value;
}

// Modal controls with smooth transitions
function showModal(mode = 'create') {
    currentModalMode = mode;
    modalOverlay.classList.add('active');
    mainContent.classList.add('hidden');
    switchModalMode(currentModalMode);
    if (currentModalMode === 'create' && projectNameInput) {
        setTimeout(() => projectNameInput.focus(), 300);
    }
}

function hideModal() {
    // Fade out animation
    modalOverlay.style.opacity = '0';
    setTimeout(() => {
        modalOverlay.classList.remove('active');
        mainContent.classList.remove('hidden');
        modalOverlay.style.opacity = '1';
    }, 200);
}

function switchModalMode(mode) {
    currentModalMode = mode;

    if (modeCreateBtn && modeExistingBtn) {
        modeCreateBtn.classList.toggle('active', mode === 'create');
        modeExistingBtn.classList.toggle('active', mode === 'existing');
    }

    modalCreateSection?.classList.toggle('hidden', mode !== 'create');
    modalExistingSection?.classList.toggle('hidden', mode !== 'existing');

    if (mode === 'existing') {
        renderExistingTrips(cachedTrips);
    }
}

// View trip details
function viewTrip(tripId) {
    window.location.href = `/ui/trip.html?id=${tripId}`;
}

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function capitalize(str) {
    if (!str || typeof str !== 'string') {
        return '';
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Set minimum date to today
const today = new Date().toISOString().split('T')[0];
document.getElementById('travelDate').setAttribute('min', today);

async function saveOrganizerPreferences(tripId, answers) {
    try {
        const participantsResponse = await fetch(`${API_BASE_URL}/trips/${tripId}/participants`);
        if (!participantsResponse.ok) {
            return;
        }
        const participants = await participantsResponse.json();
        const organizer = participants.find((p) => p.role === 'organizer');
        if (!organizer) {
            return;
        }
        await fetch(`${API_BASE_URL}/trips/${tripId}/participants/${organizer.id}/survey-response`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers }),
        });
    } catch (err) {
        console.error('Failed to save organizer preferences', err);
    }
}
