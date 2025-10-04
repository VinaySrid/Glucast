// lib/mock.ts
export const mockUser = { name: 'Sarah', email: 'sarah@example.com' };

export const mockMeals = [
  { id: '1', title: 'Oatmeal with berries', time: '8:30 AM', carbs: 45, peak: 142, thumbnail: '🥣' },
  { id: '2', title: 'Chicken salad',       time: '12:45 PM', carbs: 18, peak: 115, thumbnail: '🥗' },
  { id: '3', title: 'Grilled salmon',      time: '7:15 PM',  carbs: 8,  peak: 108, thumbnail: '🐟' },
];

export const mockSuggestions = [
  { title: 'Swap white rice → brown rice', delta: -12, rationale: 'Higher fiber content slows glucose absorption' },
  { title: 'Reduce portion by 25%',        delta: -18, rationale: 'Less carbs = lower peak response' },
  { title: '10-min walk after eating',     delta: -8,  rationale: 'Light activity helps glucose uptake' }
];