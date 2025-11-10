const state = {
  tripId: null,
  participants: [],
  surveyId: null,
  recommendations: [],
};

const els = {
  tripForm: document.querySelector('#trip-form'),
  participantForm: document.querySelector('#participant-form'),
  surveyForm: document.querySelector('#survey-form'),
  responseForm: document.querySelector('#response-form'),
  recommendationForm: document.querySelector('#recommendation-form'),
  recommendationList: document.querySelector('#recommendation-list'),
  voteForm: document.querySelector('#vote-form'),
  rankingContainer: document.querySelector('#ranking-container'),
  resultsOutput: document.querySelector('#results-output'),
  refreshResults: document.querySelector('#refresh-results'),
  participantSelects: document.querySelectorAll('select[name="participant_id"]'),
  status: {
    trip: document.querySelector('#trip-status'),
    participants: document.querySelector('#participant-status'),
    survey: document.querySelector('#survey-status'),
    recs: document.querySelector('#recommendation-status'),
    result: document.querySelector('#result-status'),
  },
};

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  if (response.status === 204) return null;
  return response.json();
};

const toast = (message, intent = 'info') => {
  const node = document.createElement('div');
  node.className = 'toast';
  node.style.borderColor = intent === 'error' ? '#f87171' : '#2f81f7';
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2600);
};

const ensureTrip = () => {
  if (!state.tripId) {
    throw new Error('Please create a trip first.');
  }
};

const updateParticipantOptions = () => {
  els.participantSelects.forEach((select) => {
    select.innerHTML = '<option value="">Select participant</option>';
    state.participants.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
  });
  els.status.participants.textContent = String(state.participants.length);
};

const updateRecommendationsUI = () => {
  els.recommendationList.innerHTML = '';
  els.rankingContainer.innerHTML = '';
  state.recommendations.forEach((rec, idx) => {
    const item = document.createElement('li');
    const extra = rec.extra || {};
    const highlights = Array.isArray(extra.highlights)
      ? extra.highlights
      : extra.highlights
        ? [extra.highlights]
        : [];
    const tips = Array.isArray(extra.travel_tips)
      ? extra.travel_tips
      : extra.travel_tips
        ? [extra.travel_tips]
        : [];

    const header = document.createElement('div');
    header.className = 'recommendation-header';
    const title = document.createElement('h3');
    title.textContent = rec.title;
    const description = document.createElement('p');
    description.className = 'recommendation-description';
    description.textContent = rec.description;
    header.append(title, description);
    item.appendChild(header);

    const meta = document.createElement('div');
    meta.className = 'recommendation-meta';
    const metaEntries = [];
    if (extra.vibe) metaEntries.push(`Vibe: ${extra.vibe}`);
    if (typeof extra.estimated_cost === 'number') {
      metaEntries.push(`Est. Cost: $${Number(extra.estimated_cost).toLocaleString()}`);
    }
    if (typeof extra.confidence_score === 'number') {
      metaEntries.push(`Confidence: ${(extra.confidence_score * 100).toFixed(0)}%`);
    }
    if (metaEntries.length === 0) {
      metaEntries.push('Model curated suggestion');
    }
    metaEntries.forEach((text) => {
      const badge = document.createElement('span');
      badge.textContent = text;
      meta.appendChild(badge);
    });
    item.appendChild(meta);

    if (highlights.length || tips.length) {
      const listContainer = document.createElement('div');
      listContainer.className = 'recommendation-lists';

      if (highlights.length) {
        const block = document.createElement('div');
        const heading = document.createElement('strong');
        heading.textContent = 'Highlights';
        const ul = document.createElement('ul');
        highlights.forEach((entry) => {
          const li = document.createElement('li');
          li.textContent = entry;
          ul.appendChild(li);
        });
        block.append(heading, ul);
        listContainer.appendChild(block);
      }

      if (tips.length) {
        const block = document.createElement('div');
        const heading = document.createElement('strong');
        heading.textContent = 'Travel Tips';
        const ul = document.createElement('ul');
        tips.forEach((entry) => {
          const li = document.createElement('li');
          li.textContent = entry;
          ul.appendChild(li);
        });
        block.append(heading, ul);
        listContainer.appendChild(block);
      }

      item.appendChild(listContainer);
    }

    const footer = document.createElement('div');
    footer.className = 'recommendation-footer';
    const modelSpan = document.createElement('span');
    modelSpan.textContent = rec.model_name;
    const variantSpan = document.createElement('span');
    variantSpan.textContent = `Variant: ${rec.prompt_variant}`;
    footer.append(modelSpan, variantSpan);
    item.appendChild(footer);

    els.recommendationList.appendChild(item);

    const rankRow = document.createElement('div');
    rankRow.className = 'ranking-item';
    const label = document.createElement('label');
    const select = document.createElement('select');
    select.name = `rank_${idx + 1}`;
    select.dataset.recId = rec.id;
    select.required = true;
    state.recommendations.forEach((candidate) => {
      const option = document.createElement('option');
      option.value = candidate.id;
      option.textContent = candidate.title;
      if (candidate.id === rec.id) option.selected = true;
      select.appendChild(option);
    });
    label.append(`Rank ${idx + 1}`, select);
    rankRow.appendChild(label);
    els.rankingContainer.appendChild(rankRow);
  });
  els.status.recs.textContent = String(state.recommendations.length);
};

const setTripStatus = (trip) => {
  state.tripId = trip.id;
  els.status.trip.textContent = `${trip.name} (${trip.id.slice(0, 8)})`;
};

const setSurveyStatus = (survey) => {
  state.surveyId = survey.id;
  els.status.survey.textContent = `${survey.name} (${survey.survey_type})`;
  toast('Survey ready. You can record responses now.');
};

const renderResults = (result) => {
  if (!result || !result.vote_round) {
    els.resultsOutput.textContent = 'No results yet.';
    els.status.result.textContent = 'Pending';
    return;
  }

  const winnerId = result.vote_round.results?.winner;
  const winner = state.recommendations.find((rec) => rec.id === winnerId);
  const rounds = Array.isArray(result.vote_round.results?.rounds)
    ? result.vote_round.results.rounds
    : [];

  els.resultsOutput.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = winner ? winner.title : winnerId || 'Winner not determined';
  const summary = document.createElement('p');
  summary.className = 'winner-summary';
  summary.textContent = winner
    ? winner.description
    : winnerId
      ? 'Winner selected earlier in the flow. Generate fresh recommendations to view more detail.'
      : 'No votes tallied yet.';

  const metrics = document.createElement('div');
  metrics.className = 'results-metrics';
  [`Status: ${result.vote_round.status}`, `Method: ${result.vote_round.method}`, `Rounds: ${rounds.length}`].forEach(
    (text) => {
      const span = document.createElement('span');
      span.textContent = text;
      metrics.appendChild(span);
    }
  );

  const roundsContainer = document.createElement('div');
  roundsContainer.className = 'results-rounds';
  if (rounds.length) {
    rounds.forEach((tally, index) => {
      const block = document.createElement('div');
      const heading = document.createElement('h4');
      heading.textContent = `Round ${index + 1}`;
      const ul = document.createElement('ul');
      const entries = Object.entries(tally || {});
      if (!entries.length) {
        const li = document.createElement('li');
        li.textContent = 'No votes cast.';
        ul.appendChild(li);
      } else {
        entries.forEach(([id, votes]) => {
          const li = document.createElement('li');
          const rec = state.recommendations.find((candidate) => candidate.id === id);
          const label = rec ? rec.title : id;
          li.textContent = `${label} — ${votes} vote${votes === 1 ? '' : 's'}`;
          ul.appendChild(li);
        });
      }
      block.append(heading, ul);
      roundsContainer.appendChild(block);
    });
  } else {
    const block = document.createElement('div');
    const heading = document.createElement('h4');
    heading.textContent = 'No vote tallies yet.';
    block.appendChild(heading);
    roundsContainer.appendChild(block);
  }

  els.resultsOutput.append(title, summary, metrics, roundsContainer);

  els.status.result.textContent = winner ? winner.title : winnerId ?? 'Pending';
};

els.tripForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formEl = event.currentTarget;
  if (!(formEl instanceof HTMLFormElement)) {
    return;
  }
  const form = new FormData(formEl);
  const payload = Object.fromEntries(form.entries());
  payload.tags = payload.tags ? payload.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  try {
    const trip = await api('/trips', { method: 'POST', body: JSON.stringify(payload) });
    setTripStatus(trip);
    toast('Trip created. Continue adding participants.');
    formEl.reset();
  } catch (error) {
    toast(error.message, 'error');
  }
});

els.participantForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formEl = event.currentTarget;
  if (!(formEl instanceof HTMLFormElement)) {
    return;
  }
  ensureTrip();
  const form = new FormData(formEl);
  const payload = Object.fromEntries(form.entries());

  try {
    const participant = await api(`/trips/${state.tripId}/participants`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.participants.push(participant);
    updateParticipantOptions();
    toast(`Added ${participant.name}.`);
    formEl.reset();
  } catch (error) {
    toast(error.message, 'error');
  }
});

els.surveyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formEl = event.currentTarget;
  if (!(formEl instanceof HTMLFormElement)) {
    return;
  }
  ensureTrip();
  const form = new FormData(formEl);
  const payload = {
    name: form.get('name'),
    survey_type: 'preferences',
    questions: [
      { id: 'q1', text: form.get('question1'), type: 'text' },
      { id: 'q2', text: form.get('question2'), type: 'text' },
    ],
  };

  try {
    const survey = await api(`/trips/${state.tripId}/surveys`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setSurveyStatus(survey);
  } catch (error) {
    toast(error.message, 'error');
  }
});

els.responseForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formEl = event.currentTarget;
  if (!(formEl instanceof HTMLFormElement)) {
    return;
  }
  ensureTrip();
  if (!state.surveyId) {
    toast('Create a survey first.', 'error');
    return;
  }

  const form = new FormData(formEl);
  const payload = {
    participant_id: form.get('participant_id'),
    answers: {
      vibe: form.get('vibe'),
      no_go: form.get('no_go'),
    },
  };

  try {
    await api(`/trips/${state.tripId}/surveys/${state.surveyId}/responses`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    toast('Response recorded.');
    formEl.reset();
    updateParticipantOptions();
  } catch (error) {
    toast(error.message, 'error');
  }
});

els.recommendationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formEl = event.currentTarget;
  if (!(formEl instanceof HTMLFormElement)) {
    return;
  }
  ensureTrip();
  const form = new FormData(formEl);
  const payload = {
    prompt_variant: form.get('prompt_variant') || 'baseline',
    candidate_count: Number(form.get('candidate_count') || 3),
  };

  try {
    const recommendations = await api(`/trips/${state.tripId}/recommendations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.recommendations = recommendations;
    updateRecommendationsUI();
    toast('Recommendations ready. Submit a vote!');
  } catch (error) {
    toast(error.message, 'error');
  }
});

els.voteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formEl = event.currentTarget;
  if (!(formEl instanceof HTMLFormElement)) {
    return;
  }
  ensureTrip();
  if (!state.recommendations.length) {
    toast('Generate recommendations first.', 'error');
    return;
  }

  const form = new FormData(formEl);
  const participantId = form.get('participant_id');
  const rankings = Array.from(els.rankingContainer.querySelectorAll('select')).map((select, idx) => ({
    recommendation_id: select.value,
    rank: idx + 1,
  }));

  try {
    await api(`/trips/${state.tripId}/votes`, {
      method: 'POST',
      body: JSON.stringify({ participant_id: participantId, rankings }),
    });
    toast('Vote submitted. Check results!');
    formEl.reset();
  } catch (error) {
    toast(error.message, 'error');
  }
});

els.refreshResults.addEventListener('click', async () => {
  try {
    ensureTrip();
    const result = await api(`/trips/${state.tripId}/results`);
    renderResults(result);
  } catch (error) {
    toast(error.message, 'error');
  }
});

// Warm up health check
api('/healthz')
  .then(() => toast('Backend is live.', 'info'))
  .catch(() => toast('Backend is unreachable. Start the API first.', 'error'));

updateParticipantOptions();
updateRecommendationsUI();
renderResults(null);

