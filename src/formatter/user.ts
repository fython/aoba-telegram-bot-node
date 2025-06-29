import { FmtString, link } from 'telegraf/format';
import { User } from 'telegraf/types';

export function formatUser(user: User): string {
  const username = user.username ? `/@${user.username}` : '';
  return `${user.id}${username}(${user.first_name || user.username})`;
}

export function userLink(user: User): FmtString {
  const firstName = user.first_name;
  const fullName = user.last_name ? `${firstName} ${user.last_name}` : firstName;
  return link(fullName, `tg://user?id=${user.id}`);
}
