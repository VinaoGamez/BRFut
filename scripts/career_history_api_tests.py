from pathlib import Path
from tempfile import TemporaryDirectory

from brfut_api.career_history import get_club_seasons, get_manager_history, get_season_history, put_season_history
from brfut_api.player_stats import get_club_history, get_match_manifest, put_match_batch
from brfut_api.auth import ApiError


def main() -> None:
    with TemporaryDirectory() as temporary:
        root = Path(temporary)
        match = {
            'fixtureId': '2028:C:1:A:B', 'season': 2028, 'competitionId': 'C',
            'homeClub': 'A', 'awayClub': 'B', 'homeGoals': 2, 'awayGoals': 1,
            'players': [
                {'playerId': 'p1', 'name': 'Um', 'clubId': 'A', 'minutes': 90, 'goals': 2, 'rating': 8},
                {'playerId': 'p2', 'name': 'Dois', 'clubId': 'B', 'minutes': 90, 'goals': 1, 'rating': 7},
            ],
        }
        assert put_match_batch(root, 'tester', 'slot-1', {'matches': [match]})['accepted'] == 1
        assert len(get_match_manifest(root, 'tester', 'slot-1', 2028)['matches']) == 1
        club = get_club_history(root, 'tester', 'slot-1', 'A')['competitions'][0]
        assert club['games'] == 1 and club['wins'] == 1

        archive = {
            'careerSeason': 2028, 'userClub': 'A', 'userDivision': 'C',
            'standings': {'C': [{'club': 'A', 'played': 1, 'wins': 1, 'draws': 0, 'losses': 0}]},
            'champions': {'C': 'A'}, 'closedAt': '2028-12-01T00:00:00Z',
        }
        managers = {'managers': [{
            'id': 'm1', 'name': 'Técnico',
            'careerHistory': {'seasons': [{
                'season': 2028, 'clubs': ['A'], 'games': 1, 'wins': 1,
                'draws': 0, 'losses': 0, 'teamAverage': 8,
                'titles': [{'id': '2028:C:A', 'competition': 'Série C', 'club': 'A'}],
            }]},
        }]}
        result = put_season_history(root, 'tester', 'slot-1', {'archive': archive, 'managerRanking': managers})
        assert result['stored'] and len(result['checksum']) == 64
        assert get_season_history(root, 'tester', 'slot-1', 2028)['archive']['champions']['C'] == 'A'
        manager = get_manager_history(root, 'tester', 'slot-1', 'm1')['seasons'][0]
        assert manager['wins'] == 1 and manager['titles'][0]['club'] == 'A'
        club_season = get_club_seasons(root, 'tester', 'slot-1', 'A')['competitions'][0]
        assert club_season['champion'] == 1 and club_season['competition_id'] == 'C'
        invalid = {**archive, 'champions': {'C': 'B'}}
        try:
            put_season_history(root, 'tester', 'slot-1', {'archive': invalid})
            raise AssertionError('campeão divergente deveria ser rejeitado')
        except ApiError as error:
            assert error.code == 'champion_mismatch'
    print('career history API tests passed')


if __name__ == '__main__':
    main()
