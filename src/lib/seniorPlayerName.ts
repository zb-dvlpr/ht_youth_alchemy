export type SeniorPlayerNameInput = {
  FirstName?: string | null;
  NickName?: string | null;
  LastName?: string | null;
  firstName?: string | null;
  nickName?: string | null;
  lastName?: string | null;
};

const cleanNamePart = (value: string | null | undefined): string =>
  typeof value === "string" ? value.trim() : "";

export const formatSeniorPlayerName = (player: SeniorPlayerNameInput): string => {
  const firstName = cleanNamePart(player.FirstName ?? player.firstName);
  const nickName = cleanNamePart(player.NickName ?? player.nickName);
  const lastName = cleanNamePart(player.LastName ?? player.lastName);

  return [firstName, nickName ? `'${nickName}'` : "", lastName]
    .filter(Boolean)
    .join(" ");
};
