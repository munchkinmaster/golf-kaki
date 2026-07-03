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
    courseName: string;
    summaryLine: string;
  };
  MatchLobby: {
    matchName: string;
    courseName: string;
    summaryLine: string;
    gameModeName: string;
    golferCount: number;
  };
  Scorecard: {
    matchName: string;
    courseName: string;
    gameModeName: string;
    isHost: boolean;
  };
  Leaderboard: {
    matchName: string;
    courseName: string;
    gameModeName: string;
  };
  InGameLobby: {
    matchName: string;
    courseName: string;
    gameModeName: string;
  };
  Finish: {
    matchName: string;
    courseName: string;
    gameModeName: string;
  };
  Recap: {
    matchName: string;
    courseName: string;
    gameModeName: string;
  };
};
