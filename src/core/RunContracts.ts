export type RunContractId =
  | "catchSnappers"
  | "openChest"
  | "reach120m"
  | "cleanRun"
  | "chain8";

export type RunContractDef = {
  id: RunContractId;
  title: string;
  description: string;
  rewardCoins: number;
  target: number;
};

export type RunContractProgress = {
  id: RunContractId;
  title: string;
  description: string;
  rewardCoins: number;
  progress: number;
  target: number;
  completed: boolean;
};

export const RUN_CONTRACTS: readonly RunContractDef[] = [
  {
    id: "catchSnappers",
    title: "SNAPPER HUNTER",
    description: "Catch 3 snappers in one run.",
    rewardCoins: 1600,
    target: 3,
  },
  {
    id: "openChest",
    title: "TREASURE POP",
    description: "Open 1 chest in the bonus round.",
    rewardCoins: 2200,
    target: 1,
  },
  {
    id: "reach120m",
    title: "DEEP DIVE",
    description: "Reach 120m before the line turns back.",
    rewardCoins: 1800,
    target: 120,
  },
  {
    id: "cleanRun",
    title: "CLEAN RUN",
    description: "Finish a run without catching trash.",
    rewardCoins: 1700,
    target: 1,
  },
  {
    id: "chain8",
    title: "DANGER PRO",
    description: "Build an x8 danger chain on the way down.",
    rewardCoins: 2100,
    target: 8,
  },
] as const;

export function runContractById(id: RunContractId): RunContractDef {
  return RUN_CONTRACTS.find((contract) => contract.id === id) ?? RUN_CONTRACTS[0]!;
}

export function firstRunContractId(): RunContractId {
  return RUN_CONTRACTS[0]!.id;
}

export function nextRunContractId(currentId: RunContractId): RunContractId {
  const index = RUN_CONTRACTS.findIndex((contract) => contract.id === currentId);
  if (index < 0) return firstRunContractId();
  return RUN_CONTRACTS[(index + 1) % RUN_CONTRACTS.length]!.id;
}

export function buildRunContractProgress(
  id: RunContractId,
  progress: number,
  completed: boolean,
): RunContractProgress {
  const contract = runContractById(id);
  return {
    id,
    title: contract.title,
    description: contract.description,
    rewardCoins: contract.rewardCoins,
    progress: Math.min(contract.target, Math.max(0, Math.floor(progress))),
    target: contract.target,
    completed,
  };
}
