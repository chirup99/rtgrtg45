import { nanoid } from "nanoid";
import { 
  createUserPost, 
  getUserPost, 
  getAllUserPosts, 
  updateUserPost, 
  deleteUserPost, 
  createLike, 
  deleteLike, 
  userLikedPost, 
  createRetweet, 
  deleteRetweet, 
  createComment, 
  getPostComments, 
  createFinanceNews, 
  getFinanceNews, 
  createOrUpdateUserProfile, 
  getUserProfile,
  getPostLikesCount,
  getPostRetweetsCount,
  getPostCommentsCount,
  TABLES 
} from './neofeed-dynamodb-migration';

export function registerNeoFeedAwsRoutes(app: any) {
  console.log('🔷 Registering NeoFeed AWS DynamoDB routes...');

  app.get('/api/social-posts', async (req: any, res: any) => {
    try {
      console.log('📱 Fetching social posts from AWS DynamoDB');
      
      const { items: userPosts } = await getAllUserPosts(50);
      const financePosts = await getFinanceNews(20);
      
      const allPosts = [
        ...userPosts.map((post: any) => ({ ...post, source: 'aws' })),
        ...financePosts.map((post: any) => ({ ...post, source: 'aws', isFinanceNews: true }))
      ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      console.log(`✅ Retrieved ${allPosts.length} posts from AWS DynamoDB`);
      res.json(allPosts);
    } catch (error: any) {
      console.error('❌ Error fetching posts from AWS:', error);
      res.status(500).json({ error: 'Failed to fetch posts' });
    }
  });

  app.post('/api/social-posts', async (req: any, res: any) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`🚀 [${requestId}] Creating post on AWS DynamoDB`);
    
    try {
      const { userId, content, stockMentions, sentiment, tags, hasImage, imageUrl, isAudioPost, selectedPostIds, selectedPosts, authorUsername, authorDisplayName } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Post content is required' });
      }

      const postData = {
        content: content.trim(),
        authorUsername: authorUsername || 'anonymous',
        authorDisplayName: authorDisplayName || 'User',
        userId: userId || nanoid(),
        stockMentions: stockMentions || [],
        sentiment: sentiment || 'neutral',
        tags: tags || [],
        hasImage: hasImage || false,
        imageUrl: imageUrl || null,
        isAudioPost: isAudioPost || false,
        selectedPostIds: selectedPostIds || [],
        selectedPosts: selectedPosts || []
      };

      const createdPost = await createUserPost(postData);
      console.log(`✅ [${requestId}] Post created on AWS: ${createdPost.id}`);
      res.json(createdPost);
    } catch (error: any) {
      console.error(`❌ [${requestId}] Error creating post:`, error);
      res.status(500).json({ error: 'Failed to create post' });
    }
  });

  app.delete('/api/social-posts/:postId', async (req: any, res: any) => {
    try {
      const { postId } = req.params;
      const userId = req.body?.userId;

      const post = await getUserPost(postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      if (userId && post.userId !== userId) {
        return res.status(403).json({ error: 'You can only delete your own posts' });
      }

      await deleteUserPost(postId);
      console.log(`✅ Post ${postId} deleted from AWS`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('❌ Error deleting post:', error);
      res.status(500).json({ error: 'Failed to delete post' });
    }
  });

  app.put('/api/social-posts/:postId', async (req: any, res: any) => {
    try {
      const { postId } = req.params;
      const { content, userId } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Post content is required' });
      }

      const post = await getUserPost(postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      if (userId && post.userId !== userId) {
        return res.status(403).json({ error: 'You can only edit your own posts' });
      }

      await updateUserPost(postId, { content: content.trim() });
      console.log(`✅ Post ${postId} updated on AWS`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('❌ Error updating post:', error);
      res.status(500).json({ error: 'Failed to update post' });
    }
  });

  app.post('/api/social-posts/:id/like', async (req: any, res: any) => {
    try {
      const postId = req.params.id;
      const userId = req.body?.userId || 'anonymous';

      const alreadyLiked = await userLikedPost(userId, postId);
      if (alreadyLiked) {
        const count = await getPostLikesCount(postId);
        return res.json({ success: true, liked: true, likes: count });
      }

      await createLike(userId, postId);
      const count = await getPostLikesCount(postId);
      console.log(`✅ Post ${postId} liked by ${userId}`);
      res.json({ success: true, liked: true, likes: count });
    } catch (error: any) {
      console.error('❌ Error liking post:', error);
      res.status(500).json({ error: 'Failed to like post' });
    }
  });

  app.delete('/api/social-posts/:id/like', async (req: any, res: any) => {
    try {
      const postId = req.params.id;
      const userId = req.body?.userId || 'anonymous';

      await deleteLike(userId, postId);
      const count = await getPostLikesCount(postId);
      console.log(`✅ Post ${postId} unliked by ${userId}`);
      res.json({ success: true, liked: false, likes: count });
    } catch (error: any) {
      console.error('❌ Error unliking post:', error);
      res.status(500).json({ error: 'Failed to unlike post' });
    }
  });

  app.post('/api/social-posts/:id/repost', async (req: any, res: any) => {
    try {
      const postId = req.params.id;
      const userId = req.body?.userId || 'anonymous';

      await createRetweet(userId, postId);
      const count = await getPostRetweetsCount(postId);
      console.log(`✅ Post ${postId} retweeted by ${userId}`);
      res.json({ success: true, reposts: count });
    } catch (error: any) {
      console.error('❌ Error retweeting:', error);
      res.status(500).json({ error: 'Failed to retweet' });
    }
  });

  app.delete('/api/social-posts/:id/repost', async (req: any, res: any) => {
    try {
      const postId = req.params.id;
      const userId = req.body?.userId || 'anonymous';

      await deleteRetweet(userId, postId);
      const count = await getPostRetweetsCount(postId);
      console.log(`✅ Post ${postId} retweet removed by ${userId}`);
      res.json({ success: true, reposts: count });
    } catch (error: any) {
      console.error('❌ Error removing retweet:', error);
      res.status(500).json({ error: 'Failed to remove retweet' });
    }
  });

  app.post('/api/social-posts/:id/comment', async (req: any, res: any) => {
    try {
      const postId = req.params.id;
      const { content, userId, authorUsername, authorDisplayName } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Comment content is required' });
      }

      const comment = await createComment({
        postId,
        content: content.trim(),
        userId: userId || 'anonymous',
        authorUsername: authorUsername || 'anonymous',
        authorDisplayName: authorDisplayName || 'User'
      });

      const count = await getPostCommentsCount(postId);
      console.log(`✅ Comment added to post ${postId}`);
      res.json({ ...comment, comments: count });
    } catch (error: any) {
      console.error('❌ Error adding comment:', error);
      res.status(500).json({ error: 'Failed to add comment' });
    }
  });

  app.get('/api/social-posts/:postId/comments-list', async (req: any, res: any) => {
    try {
      const { postId } = req.params;
      const comments = await getPostComments(postId);
      res.json(comments || []);
    } catch (error: any) {
      console.error('❌ Error fetching comments:', error);
      res.json([]);
    }
  });

  app.get('/api/social-posts/:id/comments', async (req: any, res: any) => {
    try {
      const postId = req.params.id;
      const comments = await getPostComments(postId);
      res.json(comments || []);
    } catch (error: any) {
      console.error('❌ Error fetching comments:', error);
      res.json([]);
    }
  });

  app.post('/api/social-posts/:postId/like-v2', async (req: any, res: any) => {
    try {
      const { postId } = req.params;
      const userId = req.body?.userId || 'anonymous';

      await createLike(userId, postId);
      const count = await getPostLikesCount(postId);
      res.json({ success: true, liked: true, likes: count });
    } catch (error: any) {
      console.error('❌ Error liking post:', error);
      res.status(500).json({ error: 'Failed to like post' });
    }
  });

  app.delete('/api/social-posts/:postId/like-v2', async (req: any, res: any) => {
    try {
      const { postId } = req.params;
      const userId = req.body?.userId || 'anonymous';

      await deleteLike(userId, postId);
      const count = await getPostLikesCount(postId);
      res.json({ success: true, liked: false, likes: count });
    } catch (error: any) {
      console.error('❌ Error unliking post:', error);
      res.status(500).json({ error: 'Failed to unlike post' });
    }
  });

  app.get('/api/social-posts/:postId/like-status', async (req: any, res: any) => {
    try {
      const { postId } = req.params;
      const userId = req.query?.userId || 'anonymous';
      const liked = await userLikedPost(userId as string, postId);
      const count = await getPostLikesCount(postId);
      res.json({ liked, likes: count });
    } catch (error: any) {
      res.json({ liked: false, likes: 0 });
    }
  });

  app.post('/api/social-posts/:postId/retweet', async (req: any, res: any) => {
    try {
      const { postId } = req.params;
      const userId = req.body?.userId || 'anonymous';

      await createRetweet(userId, postId);
      const count = await getPostRetweetsCount(postId);
      res.json({ success: true, reposts: count });
    } catch (error: any) {
      console.error('❌ Error retweeting:', error);
      res.status(500).json({ error: 'Failed to retweet' });
    }
  });

  app.delete('/api/social-posts/:postId/retweet', async (req: any, res: any) => {
    try {
      const { postId } = req.params;
      const userId = req.body?.userId || 'anonymous';

      await deleteRetweet(userId, postId);
      const count = await getPostRetweetsCount(postId);
      res.json({ success: true, reposts: count });
    } catch (error: any) {
      console.error('❌ Error removing retweet:', error);
      res.status(500).json({ error: 'Failed to remove retweet' });
    }
  });

  app.get('/api/social-posts/:postId/retweet-status', async (req: any, res: any) => {
    try {
      const { postId } = req.params;
      const count = await getPostRetweetsCount(postId);
      res.json({ reposts: count });
    } catch (error: any) {
      res.json({ reposts: 0 });
    }
  });

  app.post('/api/social-posts/:postId/comments', async (req: any, res: any) => {
    try {
      const { postId } = req.params;
      const { content, userId, authorUsername, authorDisplayName } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Comment content is required' });
      }

      const comment = await createComment({
        postId,
        content: content.trim(),
        userId: userId || 'anonymous',
        authorUsername: authorUsername || 'anonymous',
        authorDisplayName: authorDisplayName || 'User'
      });

      res.json(comment);
    } catch (error: any) {
      console.error('❌ Error adding comment:', error);
      res.status(500).json({ error: 'Failed to add comment' });
    }
  });

  app.get('/api/neofeed/user-profile/:userId', async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const profile = await getUserProfile(userId);
      if (profile) {
        res.json(profile);
      } else {
        res.status(404).json({ error: 'Profile not found' });
      }
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  app.post('/api/neofeed/user-profile', async (req: any, res: any) => {
    try {
      const { userId, ...profileData } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }
      const profile = await createOrUpdateUserProfile(userId, profileData);
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to save profile' });
    }
  });

  app.post('/api/neofeed/finance-news', async (req: any, res: any) => {
    try {
      const newsData = req.body;
      const news = await createFinanceNews(newsData);
      res.json(news);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to create finance news' });
    }
  });

  console.log('✅ NeoFeed AWS DynamoDB routes registered successfully');
}
