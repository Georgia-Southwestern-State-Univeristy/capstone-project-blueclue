import { useState, useRef, useEffect, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';
import PriorityRecommendation from './PriorityRecommendation';
import PriorityWarningModal from './PriorityWarningModal';
import { useToast } from '../hooks/useToast';

// Validation constants
const TITLE_MIN = 5;
const TITLE_MAX = 255;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 2000;

function TicketFormEnhanced({ onSubmit }) {
  // Form data state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: '' // Empty allows AI to classify
  });

  // AI classification state
  const [aiClassification, setAiClassification] = useState(null);
  const [showAiRecommendation, setShowAiRecommendation] = useState(false);

  // Priority warning modal state
  const [showPriorityWarning, setShowPriorityWarning] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [overrideReason, setOverrideReason] = useState(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Toast notifications
  const toast = useToast();

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState({
    title: '',
    description: ''
  });

  // Track which fields have been touched
  const [touched, setTouched] = useState({
    title: false,
    description: false
  });

  // Ref for title input
  const titleRef = useRef(null);

  // Debounce timer for AI classification
  const classifyTimerRef = useRef(null);

  // Reset form to initial state
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: ''
    });
    setValidationErrors({
      title: '',
      description: ''
    });
    setTouched({
      title: false,
      description: false
    });
    setAiClassification(null);
    setShowAiRecommendation(false);
    setShowPriorityWarning(false);
    titleRef.current?.focus();
  };

  // Validate a single field
  const validateField = (name, value) => {
    switch (name) {
      case 'title':
        if (value.length === 0) {
          return 'Title is required';
        }
        if (value.length < TITLE_MIN) {
          return `Title must be at least ${TITLE_MIN} characters`;
        }
        if (value.length > TITLE_MAX) {
          return `Title must be less than ${TITLE_MAX} characters`;
        }
        return '';
      case 'description':
        if (value.length === 0) {
          return 'Description is required';
        }
        if (value.length < DESCRIPTION_MIN) {
          return `Description must be at least ${DESCRIPTION_MIN} characters`;
        }
        if (value.length > DESCRIPTION_MAX) {
          return `Description must be less than ${DESCRIPTION_MAX} characters`;
        }
        return '';
      default:
        return '';
    }
  };

  // Validate entire form
  const validateForm = () => {
    const errors = {
      title: validateField('title', formData.title),
      description: validateField('description', formData.description)
    };
    setValidationErrors(errors);
    return !errors.title && !errors.description;
  };

  // Get AI classification preview (debounced)
  const getAIPreview = useCallback(async () => {
    if (formData.title.length < TITLE_MIN || formData.description.length < DESCRIPTION_MIN) {
      return;
    }

    try {
      // This would call your AI service endpoint
      // For now, we'll simulate it
      const response = await fetch('/api/ai/classify-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${formData.title}. ${formData.description}`
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.classification) {
          setAiClassification(data.classification);
          setShowAiRecommendation(true);
        }
      }
    } catch (err) {
      console.error('AI preview failed:', err);
      // Don't show error to user for preview
    }
  }, [formData.title, formData.description]);

  // Trigger AI preview when description changes (debounced)
  useEffect(() => {
    if (classifyTimerRef.current) {
      clearTimeout(classifyTimerRef.current);
    }

    classifyTimerRef.current = setTimeout(() => {
      getAIPreview();
    }, 1000); // 1 second debounce

    return () => {
      if (classifyTimerRef.current) {
        clearTimeout(classifyTimerRef.current);
      }
    };
  }, [getAIPreview]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Validate on change if field has been touched
    if (touched[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: validateField(name, value)
      }));
    }
  };

  // Handle field blur
  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
    setValidationErrors(prev => ({
      ...prev,
      [name]: validateField(name, value)
    }));
  };

  // Accept AI recommendation
  const handleAcceptAI = () => {
    if (aiClassification) {
      setFormData(prev => ({
        ...prev,
        priority: aiClassification.priority
      }));
      setShowAiRecommendation(false);
    }
  };

  // Reject AI recommendation
  const handleRejectAI = () => {
    setShowAiRecommendation(false);
  };

  // Check if priority warning should be shown
  const shouldShowPriorityWarning = () => {
    if (!aiClassification || !formData.priority) {
      return false;
    }

    const { priority, confidence } = aiClassification;
    
    // Show warning if AI has high confidence and priorities differ significantly
    if (confidence >= 0.8 && formData.priority !== priority) {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const diff = Math.abs(priorityOrder[priority] - priorityOrder[formData.priority]);
      return diff > 1;
    }

    return false;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({
      title: true,
      description: true
    });

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Check if priority warning should be shown
    if (shouldShowPriorityWarning() && !pendingSubmit) {
      setShowPriorityWarning(true);
      return;
    }

    // Proceed with submission
    await performSubmit();
  };

  // Perform actual submission
  const performSubmit = async () => {
    setIsLoading(true);

    try {
      const submitData = {
        subject: formData.title,
        description: formData.description,
        priority: formData.priority || undefined,
        priority_override_reason: overrideReason || undefined
      };

      if (onSubmit) {
        await onSubmit(submitData);
      }
      
      resetForm();
      setPendingSubmit(false);
      setOverrideReason(null);
    } catch (err) {
      if (!onSubmit) {
        toast.error(err.message || 'An error occurred while submitting the ticket');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle priority warning modal - accept AI
  const handlePriorityWarningAcceptAI = () => {
    setFormData(prev => ({
      ...prev,
      priority: aiClassification.priority
    }));
    setShowPriorityWarning(false);
    setPendingSubmit(true);
    setOverrideReason(null);
    // Trigger submit after state update
    setTimeout(() => performSubmit(), 100);
  };

  // Handle priority warning modal - keep user selection
  const handlePriorityWarningKeepUser = (reason) => {
    setShowPriorityWarning(false);
    setPendingSubmit(true);
    setOverrideReason(reason);
    // Trigger submit after state update
    setTimeout(() => performSubmit(), 100);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title field */}
        <div>
          <label 
            htmlFor="title"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Title <span className="text-red-400">*</span>
          </label>
          <input
            ref={titleRef}
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter a brief title for your issue"
            disabled={isLoading}
            aria-required="true"
            aria-invalid={touched.title && !!validationErrors.title}
            maxLength={TITLE_MAX}
            className={`
              w-full px-4 py-2 border rounded-lg shadow-sm
              bg-gray-800 text-white placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500
              transition-colors duration-200
              ${touched.title && validationErrors.title 
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                : 'border-gray-600'
              }
            `}
          />
          <div className="flex justify-end mt-1">
            <span className={`text-xs ${
              formData.title.length > TITLE_MAX * 0.9 
                ? 'text-orange-500' 
                : 'text-gray-500'
            }`}>
              {formData.title.length}/{TITLE_MAX}
            </span>
          </div>
          {touched.title && validationErrors.title && (
            <div role="alert" className="text-red-500 text-sm mt-1">
              {validationErrors.title}
            </div>
          )}
        </div>

        {/* Description field */}
        <div>
          <label 
            htmlFor="description"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Description <span className="text-red-400">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            onBlur={handleBlur}
            rows={6}
            placeholder="Describe your issue in detail..."
            disabled={isLoading}
            aria-required="true"
            aria-invalid={touched.description && !!validationErrors.description}
            maxLength={DESCRIPTION_MAX}
            className={`
              w-full px-4 py-2 border rounded-lg shadow-sm resize-y
              bg-gray-800 text-white placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500
              transition-colors duration-200
              ${touched.description && validationErrors.description 
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                : 'border-gray-600'
              }
            `}
          />
          <div className="flex justify-end mt-1">
            <span className={`text-xs ${
              formData.description.length > DESCRIPTION_MAX * 0.9 
                ? 'text-orange-500' 
                : 'text-gray-500'
            }`}>
              {formData.description.length}/{DESCRIPTION_MAX}
            </span>
          </div>
          {touched.description && validationErrors.description && (
            <div role="alert" className="text-red-500 text-sm mt-1">
              {validationErrors.description}
            </div>
          )}
        </div>

        {/* AI Recommendation (shown after user types enough) */}
        {showAiRecommendation && aiClassification && (
          <PriorityRecommendation
            aiPriority={aiClassification.priority}
            aiConfidence={aiClassification.confidence}
            userPriority={formData.priority}
            onAccept={handleAcceptAI}
            onReject={handleRejectAI}
            showActions={!formData.priority}
          />
        )}

        {/* Priority field */}
        <div>
          <label 
            htmlFor="priority"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Priority <span className="text-gray-500 text-xs">(optional - AI will suggest if not selected)</span>
          </label>
          <select
            id="priority"
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            disabled={isLoading}
            className="
              w-full px-4 py-2 border border-gray-600 rounded-lg shadow-sm
              bg-gray-800 text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500
              transition-colors duration-200
            "
          >
            <option value="">Let AI determine priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* Submit button */}
        <button 
          type="submit" 
          disabled={isLoading}
          className="
            w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md
            hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            disabled:bg-blue-400 disabled:cursor-not-allowed
            transition-colors duration-200
            flex items-center justify-center gap-2
          "
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Submitting...</span>
            </>
          ) : (
            'Submit Ticket'
          )}
        </button>
      </form>

      {/* Priority Warning Modal */}
      {showPriorityWarning && aiClassification && (
        <PriorityWarningModal
          isOpen={showPriorityWarning}
          onClose={() => setShowPriorityWarning(false)}
          userPriority={formData.priority}
          aiPriority={aiClassification.priority}
          aiConfidence={aiClassification.confidence}
          onAcceptAI={handlePriorityWarningAcceptAI}
          onKeepUser={handlePriorityWarningKeepUser}
          ticketSubject={formData.title}
        />
      )}
    </>
  );
}

export default TicketFormEnhanced;
