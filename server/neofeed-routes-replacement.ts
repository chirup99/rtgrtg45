import { nanoid } from "nanoid";
import { verifyCognitoToken } from './cognito-auth';
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
  getUserProfileByUsername,
  getPostLikesCount,
  getPostRetweetsCount,
  getPostCommentsCount,
  createFollow,
  deleteFollow,
  isFollowing,
  getFollowersCount,
  getFollowingCount,
  getFollowersList,
  getFollowingList,
  TABLES 
} from './neofeed-dynamodb-migration';

async function getAuthenticatedUser(req: any): Promise<{ userId: string; username: string; displayName: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.split(' ')[1];
  const cognitoUser = await verifyCognitoToken(token);
  
  if (!cognitoUser) return null;
  
  const profile = await getUserProfile(cognitoUser.sub);
  
  // If no profile exists yet, use Cognito data (email username part)
  if (!profile) {
    const emailUsername = cognitoUser.email ? cognitoUser.email.split('@')[0] : cognitoUser.sub;
    return {
      userId: cognitoUser.sub,
      username: emailUsername,
      displayName: emailUsername
    };
  }
  
  return {
    userId: cognitoUser.sub,
    username: profile.username,
    displayName: profile.displayName || profile.username
  };
}

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

  app.get('/api/users/:username/followers-count', async (req: any, res: any) => {
    try {
      const username = req.params.username;
      if (!username) {
        return res.json({ followers: 0, following: 0 });
      }
      
      const followers = await getFollowersCount(username);
      const following = await getFollowingCount(username);
      
      console.log(`✅ Follower counts for ${username}: ${followers} followers, ${following} following`);
      res.json({ followers, following });
    } catch (error: any) {
      console.error('❌ Error getting follower counts:', error);
      res.json({ followers: 0, following: 0 });
    }
  });

  app.get('/api/users/:username/followers-list', async (req: any, res: any) => {
    try {
      const username = req.params.username;
      if (!username) {
        return res.json({ followers: [] });
      }
      
      const followers = await getFollowersList(username);
      console.log(`✅ Retrieved ${followers.length} followers for ${username}`);
      res.json({ followers });
    } catch (error: any) {
      console.error('❌ Error getting followers list:', error);
      res.json({ followers: [] });
    }
  });

  app.get('/api/users/:username/following-list', async (req: any, res: any) => {
    try {
      const username = req.params.username;
      if (!username) {
        return res.json({ following: [] });
      }
      
      const following = await getFollowingList(username);
      console.log(`✅ Retrieved ${following.length} following for ${username}`);
      res.json({ following });
    } catch (error: any) {
      console.error('❌ Error getting following list:', error);
      res.json({ following: [] });
    }
  });

  app.get('/api/users/:username/follow-status', async (req: any, res: any) => {
    try {
      const targetUsername = req.params.username;
      
      const currentUser = await getAuthenticatedUser(req);
      if (!currentUser) {
        return res.json({ following: false });
      }
      
      if (!targetUsername) {
        return res.json({ following: false });
      }
      
      const following = await isFollowing(currentUser.username, targetUsername);
      console.log(`🔍 Follow status check: ${currentUser.username} -> ${targetUsername}: ${following}`);
      res.json({ following });
    } catch (error: any) {
      console.error('❌ Error checking follow status:', error);
      res.json({ following: false });
    }
  });

  app.post('/api/users/:username/follow', async (req: any, res: any) => {
    try {
      const targetUsername = req.params.username;
      const { targetUserData } = req.body;
      
      console.log(`📥 FOLLOW REQUEST: target=${targetUsername}`);
      
      const currentUser = await getAuthenticatedUser(req);
      if (!currentUser) {
        console.log('❌ FOLLOW: No authenticated user');
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      console.log(`📥 FOLLOW: currentUser=${currentUser.username}, target=${targetUsername}`);
      
      if (!targetUsername) {
        return res.status(400).json({ error: 'Target username is required' });
      }
      
      if (currentUser.username.toLowerCase() === targetUsername.toLowerCase()) {
        console.log('❌ FOLLOW: Cannot follow yourself');
        return res.status(400).json({ error: 'Cannot follow yourself' });
      }
      
      const alreadyFollowing = await isFollowing(currentUser.username, targetUsername);
      console.log(`🔍 FOLLOW: Already following check: ${alreadyFollowing}`);
      
      if (alreadyFollowing) {
        const targetFollowers = await getFollowersCount(targetUsername);
        const targetFollowing = await getFollowingCount(targetUsername);
        const currentUserFollowing = await getFollowingCount(currentUser.username);
        const currentUserFollowers = await getFollowersCount(currentUser.username);
        console.log(`⚠️ ${currentUser.username} already follows ${targetUsername} - returning following: true`);
        return res.json({ 
          success: true, 
          following: true, 
          targetUser: { followers: targetFollowers, following: targetFollowing },
          currentUser: { followers: currentUserFollowers, following: currentUserFollowing }
        });
      }
      
      console.log(`🔄 FOLLOW: Creating new follow record: ${currentUser.username} -> ${targetUsername}`);
      
      await createFollow(
        currentUser.username, 
        targetUsername, 
        { displayName: currentUser.displayName }, 
        targetUserData
      );
      
      // Get updated counts for both users
      const targetFollowers = await getFollowersCount(targetUsername);
      const targetFollowing = await getFollowingCount(targetUsername);
      const currentUserFollowing = await getFollowingCount(currentUser.username);
      const currentUserFollowers = await getFollowersCount(currentUser.username);
      
      console.log(`✅ FOLLOW SUCCESS: ${currentUser.username} followed ${targetUsername}`);
      console.log(`   Target ${targetUsername}: ${targetFollowers} followers, ${targetFollowing} following`);
      console.log(`   Current ${currentUser.username}: ${currentUserFollowers} followers, ${currentUserFollowing} following`);
      console.log(`   Returning: following: true`);
      
      res.json({ 
        success: true, 
        following: true, 
        targetUser: { followers: targetFollowers, following: targetFollowing },
        currentUser: { followers: currentUserFollowers, following: currentUserFollowing }
      });
    } catch (error: any) {
      console.error('❌ Error following user:', error);
      res.status(500).json({ error: 'Failed to follow user' });
    }
  });

  app.post('/api/users/:username/unfollow', async (req: any, res: any) => {
    try {
      const targetUsername = req.params.username;
      
      console.log(`📤 UNFOLLOW REQUEST: target=${targetUsername}`);
      
      const currentUser = await getAuthenticatedUser(req);
      if (!currentUser) {
        console.log('❌ UNFOLLOW: No authenticated user');
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      console.log(`📤 UNFOLLOW: currentUser=${currentUser.username}, target=${targetUsername}`);
      
      if (!targetUsername) {
        return res.status(400).json({ error: 'Target username is required' });
      }
      
      console.log(`🔄 UNFOLLOW: Deleting follow record: ${currentUser.username} -> ${targetUsername}`);
      
      await deleteFollow(currentUser.username, targetUsername);
      
      // Get updated counts for both users
      const targetFollowers = await getFollowersCount(targetUsername);
      const targetFollowing = await getFollowingCount(targetUsername);
      const currentUserFollowing = await getFollowingCount(currentUser.username);
      const currentUserFollowers = await getFollowersCount(currentUser.username);
      
      console.log(`✅ UNFOLLOW SUCCESS: ${currentUser.username} unfollowed ${targetUsername}`);
      console.log(`   Target ${targetUsername}: ${targetFollowers} followers, ${targetFollowing} following`);
      console.log(`   Current ${currentUser.username}: ${currentUserFollowers} followers, ${currentUserFollowing} following`);
      console.log(`   Returning: following: false`);
      
      res.json({ 
        success: true, 
        following: false, 
        targetUser: { followers: targetFollowers, following: targetFollowing },
        currentUser: { followers: currentUserFollowers, following: currentUserFollowing }
      });
    } catch (error: any) {
      console.error('❌ Error unfollowing user:', error);
      res.status(500).json({ error: 'Failed to unfollow user' });
    }
  });

  app.get('/api/users/:username/profile', async (req: any, res: any) => {
    try {
      const username = req.params.username;
      const profile = await getUserProfileByUsername(username);
      
      if (profile) {
        const followers = await getFollowersCount(username);
        const following = await getFollowingCount(username);
        res.json({ 
          ...profile, 
          followers, 
          following 
        });
      } else {
        res.status(404).json({ error: 'Profile not found' });
      }
    } catch (error: any) {
      console.error('❌ Error getting user profile:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  console.log('✅ NeoFeed AWS DynamoDB routes registered successfully');
}
