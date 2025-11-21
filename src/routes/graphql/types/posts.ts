import {
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql/index.js';
import { UUID } from './uuid.js';

export const CreatePostInput = new GraphQLInputObjectType({
  name: 'CreatePostInput',
  fields: {
    title: { type: new GraphQLNonNull(GraphQLString) },
    content: { type: new GraphQLNonNull(GraphQLString) },
    authorId: { type: new GraphQLNonNull(UUID) },
  }
});

export const ChangePostInput = new GraphQLInputObjectType({
  name: 'ChangePostInput',
  fields: {
    title: { type: GraphQLString },
    content: { type: GraphQLString },
  }
});


export const posts = new GraphQLObjectType({
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