import { DynamoDBClient, CreateTableCommand, DescribeTableCommand, ResourceNotFoundException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { nanoid } from "nanoid";

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const TABLES = {
  USER_POSTS: 'neofeed-user-posts',
  LIKES: 'neofeed-likes',
  RETWEETS: 'neofeed-retweets',
  COMMENTS: 'neofeed-comments',
  FINANCE_NEWS: 'neofeed-finance-news',
  USER_PROFILES: 'neofeed-user-profiles',
  AUDIO_POSTS: 'neofeed-audio-posts',
  BANNERS: 'neofeed-banners',
  FOLLOWS: 'neofeed-follows'
};

async function tableExists(tableName: string): Promise<boolean> {
  try {
    await dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
}

async function createTableIfNotExists(tableName: string): Promise<void> {
  try {
    const exists = await tableExists(tableName);
    if (exists) {
      console.log(`✅ Table ${tableName} already exists`);
      return;
    }

    console.log(`📦 Creating table ${tableName}...`);
    await dynamoClient.send(new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }));
    console.log(`✅ Table ${tableName} created successfully`);
  } catch (error: any) {
    console.error(`❌ Error creating table ${tableName}:`, error.message);
  }
}

export async function initializeNeoFeedTables() {
  try {
    console.log('🔷 Initializing NeoFeed AWS DynamoDB tables...');
    
    // Check AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.log('⚠️ AWS credentials not configured - NeoFeed will use Firebase fallback');
      return false;
    }
    
    // Create all tables if they don't exist
    const tableNames = Object.values(TABLES);
    for (const tableName of tableNames) {
      await createTableIfNotExists(tableName);
    }
    
    console.log('✅ NeoFeed DynamoDB tables ready');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize NeoFeed tables:', error);
    return false;
  }
}

export async function createUserPost(postData: any) {
  try {
    const postId = nanoid();
    const timestamp = new Date().toISOString();
    
    const item = {
      pk: `post#${postId}`,
      sk: timestamp,
      id: postId,
      ...postData,
      createdAt: timestamp,
      updatedAt: timestamp,
      likes: 0,
      comments: 0,
      reposts: 0
    };

    await docClient.send(new PutCommand({ TableName: TABLES.USER_POSTS, Item: item }));
    console.log(`✅ User post created in AWS: ${postId}`);
    return item;
  } catch (error) {
    console.error('❌ Error creating user post in AWS:', error);
    throw error;
  }
}

export async function getUserPost(postId: string) {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.USER_POSTS,
      FilterExpression: 'id = :postId',
      ExpressionAttributeValues: { ':postId': postId }
    }));
    return result.Items?.[0] || null;
  } catch (error) {
    console.error('❌ Error fetching user post:', error);
    return null;
  }
}

export async function getUserPostsByUsername(username: string) {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.USER_POSTS,
      FilterExpression: 'authorUsername = :username',
      ExpressionAttributeValues: { ':username': username }
    }));
    return result.Items || [];
  } catch (error) {
    console.error('❌ Error fetching user posts:', error);
    return [];
  }
}

export async function updateUserPost(postId: string, updates: any) {
  try {
    const post = await getUserPost(postId);
    if (!post) return false;
    
    const updateExpressions: string[] = [];
    const expressionNames: Record<string, string> = {};
    const expressionValues: Record<string, any> = {};
    let counter = 0;

    for (const [key, value] of Object.entries(updates)) {
      updateExpressions.push(`#attr${counter} = :val${counter}`);
      expressionNames[`#attr${counter}`] = key;
      expressionValues[`:val${counter}`] = value;
      counter++;
    }

    updateExpressions.push('#updatedAt = :now');
    expressionNames['#updatedAt'] = 'updatedAt';
    expressionValues[':now'] = new Date().toISOString();

    await docClient.send(new UpdateCommand({
      TableName: TABLES.USER_POSTS,
      Key: { pk: post.pk, sk: post.sk },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues
    }));
    return true;
  } catch (error) {
    console.error('❌ Error updating user post:', error);
    return false;
  }
}

export async function deleteUserPost(postId: string) {
  try {
    const post = await getUserPost(postId);
    if (!post) return false;
    
    await docClient.send(new DeleteCommand({
      TableName: TABLES.USER_POSTS,
      Key: { pk: post.pk, sk: post.sk }
    }));
    return true;
  } catch (error) {
    console.error('❌ Error deleting user post:', error);
    return false;
  }
}

export async function getAllUserPosts(limit = 50) {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.USER_POSTS,
      Limit: limit
    }));
    
    const items = (result.Items || []).sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return { items, lastEvaluatedKey: result.LastEvaluatedKey };
  } catch (error) {
    console.error('❌ Error scanning user posts:', error);
    return { items: [], lastEvaluatedKey: undefined };
  }
}

export async function createLike(userId: string, postId: string) {
  try {
    const likeId = `${userId}_${postId}`;
    const item = {
      pk: `like#${likeId}`,
      sk: new Date().toISOString(),
      likeId,
      userId,
      postId,
      createdAt: new Date().toISOString()
    };

    await docClient.send(new PutCommand({ TableName: TABLES.LIKES, Item: item }));
    console.log(`✅ Like created: ${likeId}`);
    return item;
  } catch (error) {
    console.error('❌ Error creating like:', error);
    throw error;
  }
}

export async function deleteLike(userId: string, postId: string) {
  try {
    const likeId = `${userId}_${postId}`;
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.LIKES,
      FilterExpression: 'likeId = :likeId',
      ExpressionAttributeValues: { ':likeId': likeId }
    }));
    
    if (result.Items && result.Items.length > 0) {
      const item = result.Items[0];
      await docClient.send(new DeleteCommand({
        TableName: TABLES.LIKES,
        Key: { pk: item.pk, sk: item.sk }
      }));
    }
    return true;
  } catch (error) {
    console.error('❌ Error deleting like:', error);
    return false;
  }
}

export async function getPostLikesCount(postId: string) {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.LIKES,
      FilterExpression: 'postId = :postId',
      ExpressionAttributeValues: { ':postId': postId }
    }));
    return result.Count || 0;
  } catch (error) {
    return 0;
  }
}

export async function userLikedPost(userId: string, postId: string) {
  try {
    const likeId = `${userId}_${postId}`;
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.LIKES,
      FilterExpression: 'likeId = :likeId',
      ExpressionAttributeValues: { ':likeId': likeId }
    }));
    return (result.Items?.length || 0) > 0;
  } catch (error) {
    return false;
  }
}

export async function createRetweet(userId: string, postId: string) {
  try {
    const retweetId = `${userId}_${postId}`;
    const item = {
      pk: `retweet#${retweetId}`,
      sk: new Date().toISOString(),
      retweetId,
      userId,
      postId,
      createdAt: new Date().toISOString()
    };

    await docClient.send(new PutCommand({ TableName: TABLES.RETWEETS, Item: item }));
    console.log(`✅ Retweet created: ${retweetId}`);
    return item;
  } catch (error) {
    console.error('❌ Error creating retweet:', error);
    throw error;
  }
}

export async function deleteRetweet(userId: string, postId: string) {
  try {
    const retweetId = `${userId}_${postId}`;
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.RETWEETS,
      FilterExpression: 'retweetId = :retweetId',
      ExpressionAttributeValues: { ':retweetId': retweetId }
    }));
    
    if (result.Items && result.Items.length > 0) {
      const item = result.Items[0];
      await docClient.send(new DeleteCommand({
        TableName: TABLES.RETWEETS,
        Key: { pk: item.pk, sk: item.sk }
      }));
    }
    return true;
  } catch (error) {
    console.error('❌ Error deleting retweet:', error);
    return false;
  }
}

export async function getPostRetweetsCount(postId: string) {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.RETWEETS,
      FilterExpression: 'postId = :postId',
      ExpressionAttributeValues: { ':postId': postId }
    }));
    return result.Count || 0;
  } catch (error) {
    return 0;
  }
}

export async function createComment(commentData: any) {
  try {
    const commentId = nanoid();
    const timestamp = new Date().toISOString();
    
    const item = {
      pk: `comment#${commentId}`,
      sk: timestamp,
      id: commentId,
      ...commentData,
      createdAt: timestamp
    };

    await docClient.send(new PutCommand({ TableName: TABLES.COMMENTS, Item: item }));
    console.log(`✅ Comment created: ${commentId}`);
    return item;
  } catch (error) {
    console.error('❌ Error creating comment:', error);
    throw error;
  }
}

export async function getPostComments(postId: string) {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.COMMENTS,
      FilterExpression: 'postId = :postId',
      ExpressionAttributeValues: { ':postId': postId }
    }));
    return (result.Items || []).sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    return [];
  }
}

export async function getPostCommentsCount(postId: string) {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.COMMENTS,
      FilterExpression: 'postId = :postId',
      ExpressionAttributeValues: { ':postId': postId }
    }));
    return result.Count || 0;
  } catch (error) {
    return 0;
  }
}

export async function createFinanceNews(newsData: any) {
  try {
    const newsId = nanoid();
    const timestamp = new Date().toISOString();
    
    const item = {
      pk: `finance-news#${newsId}`,
      sk: timestamp,
      id: newsId,
      ...newsData,
      createdAt: timestamp,
      authorUsername: 'finance_news',
      authorDisplayName: 'Finance News'
    };

    await docClient.send(new PutCommand({ TableName: TABLES.FINANCE_NEWS, Item: item }));
    console.log(`✅ Finance news created: ${newsId}`);
    return item;
  } catch (error) {
    console.error('❌ Error creating finance news:', error);
    throw error;
  }
}

export async function getFinanceNews(limit = 20) {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.FINANCE_NEWS,
      Limit: limit
    }));
    return (result.Items || []).sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    return [];
  }
}

export async function createOrUpdateUserProfile(userId: string, profileData: any) {
  try {
    const item = {
      pk: `profile#${userId}`,
      sk: userId,
      userId,
      ...profileData,
      updatedAt: new Date().toISOString()
    };

    await docClient.send(new PutCommand({ TableName: TABLES.USER_PROFILES, Item: item }));
    console.log(`✅ User profile saved: ${userId}`);
    return item;
  } catch (error) {
    console.error('❌ Error saving user profile:', error);
    throw error;
  }
}

export async function getUserProfile(userId: string) {
  try {
    // Use correct key format: USER#userId for pk, PROFILE for sk (matching routes.ts)
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.USER_PROFILES,
      Key: { pk: `USER#${userId}`, sk: 'PROFILE' }
    }));
    console.log(`🔍 getUserProfile(${userId}): ${result.Item ? 'FOUND - ' + result.Item.username : 'NOT FOUND'}`);
    return result.Item || null;
  } catch (error) {
    console.error(`❌ getUserProfile error for ${userId}:`, error);
    return null;
  }
}

export async function createAudioPost(audioData: any) {
  try {
    const audioId = nanoid();
    const timestamp = new Date().toISOString();
    
    const item = {
      pk: `audio#${audioId}`,
      sk: timestamp,
      id: audioId,
      ...audioData,
      createdAt: timestamp
    };

    await docClient.send(new PutCommand({ TableName: TABLES.AUDIO_POSTS, Item: item }));
    console.log(`✅ Audio post created: ${audioId}`);
    return item;
  } catch (error) {
    console.error('❌ Error creating audio post:', error);
    throw error;
  }
}

export async function createBanner(bannerData: any) {
  try {
    const bannerId = nanoid();
    const timestamp = new Date().toISOString();
    
    const item = {
      pk: `banner#${bannerId}`,
      sk: timestamp,
      id: bannerId,
      ...bannerData,
      createdAt: timestamp
    };

    await docClient.send(new PutCommand({ TableName: TABLES.BANNERS, Item: item }));
    console.log(`✅ Banner created: ${bannerId}`);
    return item;
  } catch (error) {
    console.error('❌ Error creating banner:', error);
    throw error;
  }
}

export async function getBanners() {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.BANNERS
    }));
    return result.Items || [];
  } catch (error) {
    return [];
  }
}

export async function createFollow(followerUsername: string, followingUsername: string, followerData?: any, followingData?: any) {
  try {
    const followId = `${followerUsername}_${followingUsername}`;
    const timestamp = new Date().toISOString();
    
    const item = {
      pk: `follow#${followId}`,
      sk: timestamp,
      followId,
      followerUsername,
      followingUsername,
      followerDisplayName: followerData?.displayName || followerUsername,
      followingDisplayName: followingData?.displayName || followingUsername,
      followerAvatar: followerData?.profilePicUrl || null,
      followingAvatar: followingData?.profilePicUrl || null,
      createdAt: timestamp
    };

    await docClient.send(new PutCommand({ TableName: TABLES.FOLLOWS, Item: item }));
    console.log(`✅ Follow created: ${followerUsername} -> ${followingUsername}`);
    return item;
  } catch (error) {
    console.error('❌ Error creating follow:', error);
    throw error;
  }
}

export async function deleteFollow(followerUsername: string, followingUsername: string) {
  try {
    const followId = `${followerUsername}_${followingUsername}`;
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.FOLLOWS,
      FilterExpression: 'followId = :followId',
      ExpressionAttributeValues: { ':followId': followId }
    }));
    
    if (result.Items && result.Items.length > 0) {
      const item = result.Items[0];
      await docClient.send(new DeleteCommand({
        TableName: TABLES.FOLLOWS,
        Key: { pk: item.pk, sk: item.sk }
      }));
      console.log(`✅ Unfollowed: ${followerUsername} -> ${followingUsername}`);
    }
    return true;
  } catch (error) {
    console.error('❌ Error deleting follow:', error);
    return false;
  }
}

export async function isFollowing(followerUsername: string, followingUsername: string): Promise<boolean> {
  try {
    const followId = `${followerUsername}_${followingUsername}`;
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.FOLLOWS,
      FilterExpression: 'followId = :followId',
      ExpressionAttributeValues: { ':followId': followId }
    }));
    return (result.Items?.length || 0) > 0;
  } catch (error) {
    return false;
  }
}

export async function getFollowersCount(username: string): Promise<number> {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.FOLLOWS,
      FilterExpression: 'followingUsername = :username',
      ExpressionAttributeValues: { ':username': username }
    }));
    return result.Count || 0;
  } catch (error) {
    return 0;
  }
}

export async function getFollowingCount(username: string): Promise<number> {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.FOLLOWS,
      FilterExpression: 'followerUsername = :username',
      ExpressionAttributeValues: { ':username': username }
    }));
    return result.Count || 0;
  } catch (error) {
    return 0;
  }
}

export async function getFollowersList(username: string): Promise<any[]> {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.FOLLOWS,
      FilterExpression: 'followingUsername = :username',
      ExpressionAttributeValues: { ':username': username }
    }));
    
    return (result.Items || []).map((item: any) => ({
      id: item.followerUsername,
      username: item.followerUsername,
      displayName: item.followerDisplayName || item.followerUsername,
      avatar: item.followerAvatar,
      followedAt: item.createdAt
    }));
  } catch (error) {
    return [];
  }
}

export async function getFollowingList(username: string): Promise<any[]> {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.FOLLOWS,
      FilterExpression: 'followerUsername = :username',
      ExpressionAttributeValues: { ':username': username }
    }));
    
    return (result.Items || []).map((item: any) => ({
      id: item.followingUsername,
      username: item.followingUsername,
      displayName: item.followingDisplayName || item.followingUsername,
      avatar: item.followingAvatar,
      followedAt: item.createdAt
    }));
  } catch (error) {
    return [];
  }
}

export async function getUserProfileByUsername(username: string): Promise<any> {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.USER_PROFILES,
      FilterExpression: 'username = :username',
      ExpressionAttributeValues: { ':username': username }
    }));
    return result.Items?.[0] || null;
  } catch (error) {
    return null;
  }
}
