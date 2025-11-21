import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from 'graphql/index.js';
import { MemberTypeIdEnum, memberTypes } from './types/memberTypes.js';
import { posts } from './types/posts.js';
import { UUID } from './types/uuid.js';
import { users } from './types/users.js';
import { parseResolveInfo, type ResolveTree } from 'graphql-parse-resolve-info';
import { profiles } from './types/profiles.js';

export const query = new GraphQLObjectType({
  name: 'RootQuery',
  fields: {
    memberTypes: {
      type: new GraphQLList(memberTypes),
      description: 'Returns all member types',
      resolve: async (_, __, prisma) => await prisma.memberType.findMany(),
    },
    memberType: {
      type: memberTypes,
      args: { id: { type: new GraphQLNonNull(MemberTypeIdEnum) } },
      resolve: (_, { id }, prisma) =>
        prisma.memberType.findUnique({ where: { id } }),
    },
    posts: {
      type: new GraphQLList(posts),
      description: 'Return all posts',
      resolve: async (_, __, prisma) => await prisma.post.findMany()
    },
    post: {
      type: posts,
      args: {
        id: { type: new GraphQLNonNull(UUID) }
      },
      resolve: async (_, { id }, prisma) => await prisma.post.findUnique({ where: { id } })
    },
    users: {
      type: new GraphQLList(users),
      description: 'Return all users',
      resolve: async (_, __, prisma, info: GraphQLResolveInfo) => {
        const parsed = parseResolveInfo(info) as ResolveTree;
        const userFields = (parsed.fieldsByTypeName.User || parsed.fieldsByTypeName.users || {});

        const onlyId = (field: ResolveTree | undefined) => {
          if (!field) return false;
          const subFields = field.fieldsByTypeName.User || field.fieldsByTypeName.users || {};
          const fieldNames = Object.keys(subFields);
          return fieldNames.length === 1 && fieldNames[0] === 'id';
        };

        const wantsUserSubscribedTo = 'userSubscribedTo' in userFields;
        const wantsSubscribedToUser = 'subscribedToUser' in userFields;

        if (wantsUserSubscribedTo || wantsSubscribedToUser) {
          const include: any = {};
          if (wantsUserSubscribedTo) {
            if (onlyId(userFields.userSubscribedTo)) {
              include.userSubscribedTo = true;
            } else {
              include.userSubscribedTo = { include: { author: { include: { profile: { include: { memberType: true } }, posts: true } } } };
            }
          }
          if (wantsSubscribedToUser) {
            if (onlyId(userFields.subscribedToUser)) {
              include.subscribedToUser = true;
            } else {
              include.subscribedToUser = { include: { subscriber: { include: { profile: { include: { memberType: true } }, posts: true } } } };
            }
          }

          const usersResult = await prisma.user.findMany({ include });

          if (include.userSubscribedTo === true) {
            for (const u of usersResult) {
              if (Array.isArray(u.userSubscribedTo)) {
                u.userSubscribedTo = u.userSubscribedTo.map(rel => ({ id: rel.authorId }))
              }
            }
          }
          if (include.subscribedToUser === true) {
            for (const u of usersResult) {
              if (Array.isArray(u.subscribedToUser)) {
                u.subscribedToUser = u.subscribedToUser.map(rel => ({ id: rel.subscriberId }));
              }
            }
          }

          return usersResult;
        }
        return await prisma.user.findMany();
      }
    },
    user: {
      type: users,
      args: {
        id: { type: new GraphQLNonNull(UUID) }
      },
      resolve: async (_, { id }, prisma) => await prisma.user.findUnique({ where: { id } })
    },
    profiles: {
      type: new GraphQLList(profiles),
      description: 'Return all profiles',
      resolve: async (_, __, prisma) => await prisma.profile.findMany()
    },
    profile: {
      type: profiles,
      args: {
        id: { type: new GraphQLNonNull(UUID) }
      },
      resolve: async (_, { id }, prisma) => await prisma.profile.findUnique({ where: { id } })
    },
  }
})