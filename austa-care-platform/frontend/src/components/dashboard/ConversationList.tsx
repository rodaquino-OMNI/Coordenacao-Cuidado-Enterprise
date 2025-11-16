import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Conversation } from '@/types';
import { MessageCircle } from 'lucide-react';

interface ConversationListProps {
  conversations: Conversation[];
}

export const ConversationList: React.FC<ConversationListProps> = ({ conversations }) => {
  const navigate = useNavigate();

  if (conversations.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No conversations yet</p>
        <button
          onClick={() => navigate('/conversations/new')}
          className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Start Your First Conversation
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          onClick={() => navigate(`/conversations/${conversation.id}`)}
          className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">{conversation.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-2">{conversation.lastMessage}</p>
              <div className="flex items-center space-x-4 mt-2">
                <span className="text-xs text-gray-500">
                  {new Date(conversation.lastMessageAt).toLocaleDateString()}
                </span>
                <span className="text-xs text-gray-500">
                  {conversation.messageCount} messages
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    conversation.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {conversation.status}
                </span>
              </div>
            </div>
            <MessageCircle className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      ))}
    </div>
  );
};
