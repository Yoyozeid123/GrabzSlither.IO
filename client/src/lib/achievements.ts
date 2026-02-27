export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: number;
  unlocked: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_blood', name: 'First Blood', description: 'Reach 100 score', icon: '🎯', requirement: 100, unlocked: false },
  { id: 'growing_strong', name: 'Growing Strong', description: 'Reach 500 score', icon: '📈', requirement: 500, unlocked: false },
  { id: 'beast_mode', name: 'Beast Mode', description: 'Reach 1000 score', icon: '🔥', requirement: 1000, unlocked: false },
  { id: 'unstoppable', name: 'Unstoppable', description: 'Reach 2500 score', icon: '⚡', requirement: 2500, unlocked: false },
  { id: 'legend', name: 'Legend', description: 'Reach 5000 score', icon: '👑', requirement: 5000, unlocked: false },
  { id: 'god_mode', name: 'God Mode', description: 'Reach 10000 score', icon: '🌟', requirement: 10000, unlocked: false },
  { id: 'speed_demon', name: 'Speed Demon', description: 'Use boost 50 times', icon: '💨', requirement: 50, unlocked: false },
  { id: 'boost_master', name: 'Boost Master', description: 'Use boost 200 times', icon: '🚀', requirement: 200, unlocked: false },
  { id: 'survivor', name: 'Survivor', description: 'Survive for 5 minutes', icon: '⏱️', requirement: 300, unlocked: false },
  { id: 'marathon', name: 'Marathon', description: 'Survive for 10 minutes', icon: '🏃', requirement: 600, unlocked: false },
  { id: 'glutton', name: 'Glutton', description: 'Eat 100 pellets', icon: '🍔', requirement: 100, unlocked: false },
  { id: 'feast', name: 'Feast', description: 'Eat 500 pellets', icon: '🍕', requirement: 500, unlocked: false },
  { id: 'collector', name: 'Collector', description: 'Try all 10 skins', icon: '🎨', requirement: 10, unlocked: false },
  { id: 'top_3', name: 'Top 3', description: 'Reach rank 3 or higher', icon: '🥉', requirement: 3, unlocked: false },
  { id: 'champion', name: 'Champion', description: 'Reach rank 1', icon: '🥇', requirement: 1, unlocked: false },
];

export function getAchievements(): Achievement[] {
  const saved = localStorage.getItem('achievements');
  if (saved) {
    return JSON.parse(saved);
  }
  return [...ACHIEVEMENTS];
}

export function saveAchievements(achievements: Achievement[]) {
  localStorage.setItem('achievements', JSON.stringify(achievements));
}

export function checkAchievement(achievements: Achievement[], id: string, value: number): Achievement | null {
  const achievement = achievements.find(a => a.id === id && !a.unlocked);
  if (achievement && value >= achievement.requirement) {
    achievement.unlocked = true;
    saveAchievements(achievements);
    return achievement;
  }
  return null;
}
