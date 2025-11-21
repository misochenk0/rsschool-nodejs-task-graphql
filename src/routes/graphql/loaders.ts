import DataLoader from 'dataloader';

export function getLoaders(prisma) {

  const posts = new DataLoader(async (authorIds) => {
    const rows = await prisma.post.findMany({
      where: { authorId: { in: authorIds as string[] } },
    });
    return authorIds.map(id => rows.filter(r => r.authorId === id));
  })

  const profiles = new DataLoader(async (userIds) => {
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: userIds as string[] } },
      select: { id: true, isMale: true, yearOfBirth: true, userId: true, memberTypeId: true },
    });
    const memberTypeIds = profiles.map(p => p.memberTypeId);
    const memberTypes = await prisma.memberType.findMany({
      where: { id: { in: memberTypeIds } }
    });
    return userIds.map(id => {
      const profile = profiles.find(p => p.userId === id);
      if (!profile) return null;
      return {
        ...profile,
        memberType: memberTypes.find(mType => mType?.id === profile.memberTypeId)
      };
    });
  })

  const userSubscribedTo = new DataLoader<string, any[]>(async (subscriberIds) => {
    const rows = await prisma.subscribersOnAuthors.findMany({
      where: { subscriberId: { in: subscriberIds as string[] } },
      include: {
        author: {
          include: {
            profile: { include: { memberType: true } },
            posts: true,
          }
        }
      },
    });
    return subscriberIds.map(id =>
      rows
        .filter(r => r.subscriberId === id)
        .map(r => r.author)
    );
  })

  const subscribedToUser = new DataLoader<string, any[]>(async (authorIds) => {
    const rows = await prisma.subscribersOnAuthors.findMany({
      where: { authorId: { in: authorIds as string[] } },
      include: {
        subscriber: {
          include: {
            profile: { include: { memberType: true } },
            posts: true,
          }
        }
      },
    });
    return authorIds.map(id =>
      rows
        .filter(r => r.authorId === id)
        .map(r => r.subscriber)
    );
  })


  return {
    posts,
    profiles,
    userSubscribedTo,
    subscribedToUser,
  }
}