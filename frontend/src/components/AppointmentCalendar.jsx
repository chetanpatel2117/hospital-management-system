import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function AppointmentCalendar({ appointments, month, onMonthChange, onSelect }) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - firstDay.getDay());
  const todayKey = localDateKey(new Date());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const appointmentsByDate = appointments.reduce((groups, appointment) => {
    groups.set(appointment.date, [...(groups.get(appointment.date) || []), appointment]);
    return groups;
  }, new Map());

  function moveMonth(amount) {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + amount, 1));
  }

  return (
    <section className="calendar-panel" aria-label="Appointment calendar">
      <header className="calendar-header">
        <div><h2><CalendarDays size={17} />Appointment calendar</h2><p>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p></div>
        <div className="calendar-controls">
          <button type="button" className="secondary-button" onClick={() => onMonthChange(new Date())}>Today</button>
          <button type="button" className="small-button" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={16} /></button>
          <button type="button" className="small-button" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={16} /></button>
        </div>
      </header>
      <div className="calendar-grid calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">
        {days.map((date) => {
          const dateKey = localDateKey(date);
          const events = appointmentsByDate.get(dateKey) || [];
          const sameMonth = date.getMonth() === month.getMonth();
          return (
            <div className={`calendar-day${sameMonth ? '' : ' outside-month'}${dateKey === todayKey ? ' today' : ''}`} key={dateKey}>
              <span className="calendar-day-number">{date.getDate()}</span>
              <div className="calendar-events">
                {events.slice(0, 3).map((appointment) => <button type="button" key={appointment._id} className="calendar-event" title={`${appointment.time} · ${appointment.patientName} · ${appointment.doctorName}`} onClick={() => onSelect(appointment)}><strong>{appointment.time}</strong><span>{appointment.patientName}</span></button>)}
                {events.length > 3 && <span className="calendar-more">+{events.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>
      {!appointments.length && <p className="calendar-empty">No appointments match the current filters.</p>}
    </section>
  );
}
