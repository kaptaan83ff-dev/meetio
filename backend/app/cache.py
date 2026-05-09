# Cache key templates
DASHBOARD_STATS_KEY = "dashboard:stats:{user_id}"
DASHBOARD_RECAPS_KEY = "dashboard:recaps:{user_id}"
DASHBOARD_UPCOMING_KEY = "dashboard:upcoming:{user_id}"
USER_PROFILE_KEY = "user:profile:{user_id}"
MEETING_INFO_KEY = "meeting:info:{meeting_id}"

# TTLs (seconds)
DASHBOARD_STATS_TTL = 300
DASHBOARD_RECAPS_TTL = 300
DASHBOARD_UPCOMING_TTL = 120
USER_PROFILE_TTL = 600
MEETING_INFO_TTL = 30

# WebSocket channel name constants
# used by ConnectionManager.broadcast_to_user() and broadcast_to_meeting()
WS_USER_CHANNEL = "ws:user:{user_id}"
WS_MEETING_CHANNEL = "ws:meeting:{meeting_id}"

# OTP Redis key template
# TTL 15 min (900s) as per Task 1.3
OTP_KEY = "otp:{email}"
OTP_TTL = 900
