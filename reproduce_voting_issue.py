
from uuid import uuid4
from packvote.services.voting import compute_instant_runoff
from packvote.models import DestinationRecommendation, Vote, VoteItem

def run_test():
    # Create candidates
    c1 = DestinationRecommendation(id=uuid4(), title="Phuket")
    c2 = DestinationRecommendation(id=uuid4(), title="Bali")
    c3 = DestinationRecommendation(id=uuid4(), title="Koh Samui")
    
    recommendations = [c1, c2, c3]
    
    # Create votes
    # Voter 1: Phuket > Koh Samui > Bali
    v1 = Vote(id=uuid4(), items=[
        VoteItem(recommendation_id=c1.id, rank=1),
        VoteItem(recommendation_id=c3.id, rank=2),
        VoteItem(recommendation_id=c2.id, rank=3)
    ])
    
    # Voter 2: Bali > Koh Samui > Phuket
    v2 = Vote(id=uuid4(), items=[
        VoteItem(recommendation_id=c2.id, rank=1),
        VoteItem(recommendation_id=c3.id, rank=2),
        VoteItem(recommendation_id=c1.id, rank=3)
    ])
    
    votes = [v1, v2]
    
    result = compute_instant_runoff(recommendations, votes)
    
    print("Winner:", result["winner"])
    print("Rounds:")
    for i, round_data in enumerate(result["rounds"]):
        print(f"Round {i+1}:")
        for cand_id, count in round_data.items():
            name = next(r.title for r in recommendations if str(r.id) == cand_id)
            print(f"  {name}: {count}")

if __name__ == "__main__":
    run_test()
