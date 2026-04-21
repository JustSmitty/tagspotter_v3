import json

states_trivia = {
    "AL": {"FamousLandmark": "US Space & Rocket Center", "MovieSetting": "Forrest Gump", "SportsTeam": "Crimson Tide"},
    "AK": {"FamousLandmark": "Denali National Park", "MovieSetting": "Into the Wild", "SportsTeam": "Aces"},
    "AZ": {"FamousLandmark": "Grand Canyon", "MovieSetting": "Raising Arizona", "SportsTeam": "Cardinals"},
    "AR": {"FamousLandmark": "Hot Springs National Park", "MovieSetting": "True Grit", "SportsTeam": "Razorbacks"},
    "CA": {"FamousLandmark": "Golden Gate Bridge", "MovieSetting": "Pulp Fiction", "SportsTeam": "Lakers"},
    "CO": {"FamousLandmark": "Rocky Mountain National Park", "MovieSetting": "The Shining", "SportsTeam": "Broncos"},
    "CT": {"FamousLandmark": "Mystic Seaport", "MovieSetting": "Mystic Pizza", "SportsTeam": "Huskies"},
    "DE": {"FamousLandmark": "Rehoboth Beach Boardwalk", "MovieSetting": "Dead Poets Society", "SportsTeam": "Blue Hens"},
    "DC": {"FamousLandmark": "Lincoln Memorial", "MovieSetting": "National Treasure", "SportsTeam": "Commanders"},
    "FL": {"FamousLandmark": "Walt Disney World", "MovieSetting": "Scarface", "SportsTeam": "Dolphins"},
    "GA": {"FamousLandmark": "Centennial Olympic Park", "MovieSetting": "Gone with the Wind", "SportsTeam": "Braves"},
    "HI": {"FamousLandmark": "Pearl Harbor", "MovieSetting": "Jurassic Park", "SportsTeam": "Rainbow Warriors"},
    "ID": {"FamousLandmark": "Craters of the Moon", "MovieSetting": "Napoleon Dynamite", "SportsTeam": "Broncos (Boise State)"},
    "IL": {"FamousLandmark": "Willis Tower", "MovieSetting": "The Blues Brothers", "SportsTeam": "Bulls"},
    "IN": {"FamousLandmark": "Indianapolis Motor Speedway", "MovieSetting": "Hoosiers", "SportsTeam": "Colts"},
    "IA": {"FamousLandmark": "Amana Colonies", "MovieSetting": "Field of Dreams", "SportsTeam": "Hawkeyes"},
    "KS": {"FamousLandmark": "Monument Rocks", "MovieSetting": "The Wizard of Oz", "SportsTeam": "Chiefs"},
    "KY": {"FamousLandmark": "Mammoth Cave", "MovieSetting": "Goldfinger", "SportsTeam": "Wildcats"},
    "LA": {"FamousLandmark": "French Quarter", "MovieSetting": "A Streetcar Named Desire", "SportsTeam": "Saints"},
    "ME": {"FamousLandmark": "Acadia National Park", "MovieSetting": "The Shawshank Redemption", "SportsTeam": "Black Bears"},
    "MD": {"FamousLandmark": "Antietam National Battlefield", "MovieSetting": "The Blair Witch Project", "SportsTeam": "Ravens"},
    "MA": {"FamousLandmark": "Freedom Trail", "MovieSetting": "Good Will Hunting", "SportsTeam": "Red Sox"},
    "MI": {"FamousLandmark": "Mackinac Bridge", "MovieSetting": "8 Mile", "SportsTeam": "Lions"},
    "MN": {"FamousLandmark": "Mall of America", "MovieSetting": "Fargo", "SportsTeam": "Vikings"},
    "MS": {"FamousLandmark": "Vicksburg National Military Park", "MovieSetting": "The Help", "SportsTeam": "Rebels"},
    "MO": {"FamousLandmark": "Gateway Arch", "MovieSetting": "Gone Girl", "SportsTeam": "Chiefs"},
    "MT": {"FamousLandmark": "Glacier National Park", "MovieSetting": "A River Runs Through It", "SportsTeam": "Grizzlies"},
    "NE": {"FamousLandmark": "Chimney Rock", "MovieSetting": "Nebraska", "SportsTeam": "Cornhuskers"},
    "NV": {"FamousLandmark": "Las Vegas Strip", "MovieSetting": "Ocean's Eleven", "SportsTeam": "Raiders"},
    "NH": {"FamousLandmark": "Mount Washington", "MovieSetting": "Jumanji", "SportsTeam": "Wildcats"},
    "NJ": {"FamousLandmark": "Atlantic City Boardwalk", "MovieSetting": "Clerks", "SportsTeam": "Devils"},
    "NM": {"FamousLandmark": "Carlsbad Caverns", "MovieSetting": "No Country for Old Men", "SportsTeam": "Lobos"},
    "NY": {"FamousLandmark": "Statue of Liberty", "MovieSetting": "Ghostbusters", "SportsTeam": "Yankees"},
    "NC": {"FamousLandmark": "Biltmore Estate", "MovieSetting": "The Hunger Games", "SportsTeam": "Panthers"},
    "ND": {"FamousLandmark": "Theodore Roosevelt National Park", "MovieSetting": "Fargo", "SportsTeam": "Fighting Hawks"},
    "OH": {"FamousLandmark": "Rock and Roll Hall of Fame", "MovieSetting": "A Christmas Story", "SportsTeam": "Buckeyes"},
    "OK": {"FamousLandmark": "Route 66", "MovieSetting": "Twister", "SportsTeam": "Sooners"},
    "OR": {"FamousLandmark": "Crater Lake", "MovieSetting": "The Goonies", "SportsTeam": "Ducks"},
    "PA": {"FamousLandmark": "Liberty Bell", "MovieSetting": "Rocky", "SportsTeam": "Eagles"},
    "RI": {"FamousLandmark": "The Breakers", "MovieSetting": "There's Something About Mary", "SportsTeam": "Rams"},
    "SC": {"FamousLandmark": "Fort Sumter", "MovieSetting": "The Patriot", "SportsTeam": "Gamecocks"},
    "SD": {"FamousLandmark": "Mount Rushmore", "MovieSetting": "Dances with Wolves", "SportsTeam": "Jackrabbits"},
    "TN": {"FamousLandmark": "Great Smoky Mountains", "MovieSetting": "The Blind Side", "SportsTeam": "Titans"},
    "TX": {"FamousLandmark": "The Alamo", "MovieSetting": "No Country for Old Men", "SportsTeam": "Cowboys"},
    "UT": {"FamousLandmark": "Zion National Park", "MovieSetting": "High School Musical", "SportsTeam": "Jazz"},
    "VT": {"FamousLandmark": "Ben & Jerry's Factory", "MovieSetting": "Super Troopers", "SportsTeam": "Catamounts"},
    "VA": {"FamousLandmark": "Mount Vernon", "MovieSetting": "Remember the Titans", "SportsTeam": "Cavaliers"},
    "WA": {"FamousLandmark": "Space Needle", "MovieSetting": "Sleepless in Seattle", "SportsTeam": "Seahawks"},
    "WV": {"FamousLandmark": "New River Gorge", "MovieSetting": "October Sky", "SportsTeam": "Mountaineers"},
    "WI": {"FamousLandmark": "House on the Rock", "MovieSetting": "Bridesmaids", "SportsTeam": "Packers"},
    "WY": {"FamousLandmark": "Yellowstone National Park", "MovieSetting": "Brokeback Mountain", "SportsTeam": "Cowboys"}
}

json_path = 'src/data/states.json'
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

for state in data:
    abbrv = state.get('Abbrv')
    if abbrv in states_trivia:
        trivia = states_trivia[abbrv]
        state['FamousLandmark'] = trivia['FamousLandmark']
        state['MovieSetting'] = trivia['MovieSetting']
        state['SportsTeam'] = trivia['SportsTeam']

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=4)

print("Updated states.json successfully!")
