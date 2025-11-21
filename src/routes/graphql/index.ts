import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import {
  graphql,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLScalarType,
  Kind,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLEnumType,
  parse,
  validate,
  GraphQLInputObjectType,
  type GraphQLResolveInfo,
} from 'graphql';
import depthLimit from 'graphql-depth-limit';
import DataLoader from 'dataloader';
import { parseResolveInfo, type ResolveTree } from 'graphql-parse-resolve-info';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;

  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    async handler(req, res) {

      const document = parse(req.body.query);

      const errors = validate(schema, document, [depthLimit(5)]);
      if (errors.length > 0) return res.status(400).send({ errors });

      // attach loaders to prisma and also raw query string for resolver fallbacks
      // eslint-disable-next-line no-console
      console.error('DEBUG RAW GQL QUERY:', req.body.query);
      (prisma as any).__gqlQuery = req.body.query;

      (prisma as any).loaders = {

        posts: new DataLoader(async (authorIds) => {
          const rows = await prisma.post.findMany({
            where: { authorId: { in: authorIds as string[] } },
          });
          return authorIds.map(id => rows.filter(r => r.authorId === id));
        }),

        profiles: new DataLoader(async (userIds) => {
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
              id: profile.id,
              isMale: profile.isMale,
              yearOfBirth: profile.yearOfBirth,
              memberType: memberTypes.find(mType => mType?.id === profile.memberTypeId)
            };
          });
        }),
        userSubscribedTo: new DataLoader<string, any[]>(async (subscriberIds) => {
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
        }),
        subscribedToUser: new DataLoader<string, any[]>(async (authorIds) => {
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
        }),
      };

      return graphql({
        schema,
        source: req.body.query,
        variableValues: req.body.variables,
        contextValue: prisma,
      });
    },
  });
};

const UUID = new GraphQLScalarType({
  name: 'UUID',
  serialize: String,
  parseValue: String,
  parseLiteral: ast => (ast.kind === Kind.STRING ? ast.value : null)
});

const MemberTypeIdEnum = new GraphQLEnumType({
  name: "MemberTypeId",
  values: {
    BASIC: { value: "BASIC" },
    BUSINESS: { value: "BUSINESS" }
  }
});

const memberTypes = new GraphQLObjectType({
  name: 'MemberTypes',
  fields: {
    id: {
      type: GraphQLString,
      resolve: async function (data) {
        return data.id;
      }
    },
    discount: {
      type: GraphQLFloat,
      resolve: async function (data) {
        return data.discount;
      }
    },
    postsLimitPerMonth: {
      type: GraphQLString,
      resolve: async function (data) {
        return data.postsLimitPerMonth
      }
    }
  }
})

const posts = new GraphQLObjectType({
  name: 'posts',
  fields: {
    id: {
      type: GraphQLString,
      resolve: async (data) => data.id
    },
    title: {
      type: GraphQLString,
      resolve: async (data) => data.title
    },
    content: {
      type: GraphQLString,
      resolve: async (data) => data.content
    }
  }
})

const profiles = new GraphQLObjectType({
  name: 'profiles',
  fields: {
    id: {
      type: GraphQLString,
      resolve: async (data) => data.id
    },
    isMale: {
      type: GraphQLBoolean,
      resolve: async (data) => data.isMale
    },
    yearOfBirth: {
      type: GraphQLInt,
      resolve: async (data) => data.yearOfBirth
    },
    memberType: {
      type: memberTypes,
      resolve: async (data) => data.memberType
    }
  }
})

const users = new GraphQLObjectType({
  name: 'users',
  fields: () => ({
    id: { type: GraphQLString },
    name: { type: GraphQLString },
    balance: { type: GraphQLFloat },
    profile: {
      type: profiles,
      resolve: async (user, _, prisma) =>
        prisma.loaders.profiles.load(user.id)
    },
    posts: {
      type: new GraphQLList(posts),
      resolve: async (user, _, prisma) =>
        prisma.loaders.posts.load(user.id)
    },
    userSubscribedTo: {
      type: new GraphQLList(users),
      resolve: async (user, _, prisma) => {
        if (Array.isArray((user as any).userSubscribedTo)) {
          return (user as any).userSubscribedTo;
        }
        return prisma.loaders.userSubscribedTo.load(user.id);
      }
    },
    subscribedToUser: {
      type: new GraphQLList(users),
      resolve: async (user, _, prisma) => {
        if (Array.isArray((user as any).subscribedToUser)) {
          return (user as any).subscribedToUser;
        }
        return prisma.loaders.subscribedToUser.load(user.id);
      }
    },
  })
});


const CreatePostInput = new GraphQLInputObjectType({
  name: 'CreatePostInput',
  fields: {
    title: { type: new GraphQLNonNull(GraphQLString) },
    content: { type: new GraphQLNonNull(GraphQLString) },
    authorId: { type: new GraphQLNonNull(UUID) },
  }
});

const ChangePostInput = new GraphQLInputObjectType({
  name: 'ChangePostInput',
  fields: {
    title: { type: GraphQLString },
    content: { type: GraphQLString },
  }
});

const CreateUserInput = new GraphQLInputObjectType({
  name: 'CreateUserInput',
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
  }
});

const ChangeUserInput = new GraphQLInputObjectType({
  name: 'ChangeUserInput',
  fields: {
    name: { type: GraphQLString },
    balance: { type: GraphQLFloat },
  }
});

const CreateProfileInput = new GraphQLInputObjectType({
  name: 'CreateProfileInput',
  fields: {
    isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
    yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
    userId: { type: new GraphQLNonNull(UUID) },
    memberTypeId: { type: new GraphQLNonNull(MemberTypeIdEnum) },
  }
});

const ChangeProfileInput = new GraphQLInputObjectType({
  name: 'ChangeProfileInput',
  fields: {
    isMale: { type: GraphQLBoolean },
    yearOfBirth: { type: GraphQLInt },
    memberTypeId: { type: MemberTypeIdEnum },
  }
});

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
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
          try {
            const parsed = parseResolveInfo(info) as ResolveTree;
            const userFields = (parsed.fieldsByTypeName.User || parsed.fieldsByTypeName.users || {}) as Record<string, ResolveTree>;

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
              console.error('DEBUG prisma.user.findMany include =>', JSON.stringify(include));

              const usersResult = await prisma.user.findMany({ include });

              if (include.userSubscribedTo === true) {
                for (const u of usersResult) {
                  if (Array.isArray((u as any).userSubscribedTo)) {
                    (u as any).userSubscribedTo = (u as any).userSubscribedTo.map((rel: any) => ({ id: rel.authorId }));
                  }
                }
              }
              if (include.subscribedToUser === true) {
                for (const u of usersResult) {
                  if (Array.isArray((u as any).subscribedToUser)) {
                    (u as any).subscribedToUser = (u as any).subscribedToUser.map((rel: any) => ({ id: rel.subscriberId }));
                  }
                }
              }

              return usersResult;
            }
          } catch (e) {
            // fallback to basic findMany if parsing fails
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
  }),
  mutation: new GraphQLObjectType({
    name: 'RootMutation',
    fields: {
      createUser: {
        type: users,
        args: {
          dto: { type: new GraphQLNonNull(CreateUserInput) },
        },
        resolve: async (_, { dto }, prisma) => {
          return prisma.user.create({ data: dto });
        }
      },
      deleteUser: {
        type: UUID,
        args: {
          id: { type: new GraphQLNonNull(UUID) },
        },
        resolve: async (_, { id }, prisma) => {
          return prisma.user.delete({ where: { id } });
        }
      },
      changeUser: {
        type: users,
        args: {
          id: { type: new GraphQLNonNull(UUID) },
          dto: { type: new GraphQLNonNull(ChangeUserInput) },
        },
        resolve: async (_, { id, dto }, prisma) => {
          return prisma.user.update({ where: { id }, data: dto });
        }
      },
      createPost: {
        type: posts,
        args: {
          dto: { type: new GraphQLNonNull(CreatePostInput) },
        },
        resolve: async (_, { dto }, prisma) => {
          return prisma.post.create({ data: dto });
        }
      },
      deletePost: {
        type: UUID,
        args: {
          id: { type: new GraphQLNonNull(UUID) },
        },
        resolve: async (_, { id }, prisma) => {
          return prisma.post.delete({ where: { id } });
        }
      },
      changePost: {
        type: posts,
        args: {
          id: { type: new GraphQLNonNull(UUID) },
          dto: { type: new GraphQLNonNull(ChangePostInput) },
        },
        resolve: async (_, { id, dto }, prisma) => {
          return prisma.post.update({ where: { id }, data: dto });
        }
      },
      createProfile: {
        type: profiles,
        args: {
          dto: { type: new GraphQLNonNull(CreateProfileInput) },
        },
        resolve: async (_, { dto }, prisma) => {
          return prisma.profile.create({ data: dto });
        }
      },
      deleteProfile: {
        type: UUID,
        args: {
          id: { type: new GraphQLNonNull(UUID) },
        },
        resolve: async (_, { id }, prisma) => {
          return prisma.profile.delete({ where: { id } });
        }
      },
      changeProfile: {
        type: profiles,
        args: {
          id: { type: new GraphQLNonNull(UUID) },
          dto: { type: new GraphQLNonNull(ChangeProfileInput) },
        },
        resolve: async (_, { id, dto }, prisma) => {
          return prisma.profile.update({ where: { id }, data: dto });
        }
      },
      subscribeTo: {
        type: UUID,
        args: {
          userId: { type: new GraphQLNonNull(UUID) },
          authorId: { type: new GraphQLNonNull(UUID) },
        },
        resolve: async (_, { userId, authorId }, prisma) => {
          return prisma.subscribersOnAuthors.create({ data: { subscriberId: userId, authorId } });
        },
      },
      unsubscribeFrom: {
        type: UUID,
        args: {
          userId: { type: new GraphQLNonNull(UUID) },
          authorId: { type: new GraphQLNonNull(UUID) },
        },
        resolve: async (_, { userId, authorId }, prisma) => {
          return prisma.subscribersOnAuthors.delete({ where: { subscriberId_authorId: { subscriberId: userId, authorId } } });
        },
      },
    }
  })
})

export default plugin;