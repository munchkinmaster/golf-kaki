export type RootStackParamList = {
  Landing: undefined;
  Home: undefined;
  Profile: undefined;
  Kaki: undefined;
  Rounds: { initialTab?: 'live' | 'past' } | undefined;
  TrophyCabinet: undefined;
  BragCard: undefined;
  SelectCourse: undefined;
  JoinGame: undefined;
  CreateGame: {
    courseId: string;
    comboId: string;
    holesToPlay: 9 | 18;
    courseName: string;
    summaryLine: string;
  };
  MatchLobby: {
    matchId: string;
    matchCode: string;
    matchName: string;
    courseName: string;
    summaryLine: string;
    gameModeName: string;
    holesToPlay: 9 | 18;
  };
  Scorecard: {
    matchId: string;
    matchName: string;
    courseName: string;
    gameModeName: string;
    isHost: boolean;
  };
  Leaderboard: {
    matchId: string;
    matchName: string;
    courseName: string;
    gameModeName: string;
  };
  InGameLobby: {
    matchId: string;
    matchName: string;
    courseName: string;
    gameModeName: string;
  };
  Finish: {
    matchId: string;
    matchName: string;
    courseName: string;
    gameModeName: string;
  };
  Recap: {
    matchId: string;
    matchName: string;
    courseName: string;
    gameModeName: string;
  };
};
